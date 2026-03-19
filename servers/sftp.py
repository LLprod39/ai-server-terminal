from __future__ import annotations

import posixpath
import stat as stat_module
from contextlib import asynccontextmanager
from tempfile import SpooledTemporaryFile
from typing import Any, AsyncIterator

import asyncssh
from asyncssh import sftp as asyncssh_sftp

from servers.models import Server
from servers.ssh_host_keys import build_server_connect_kwargs, ensure_server_known_hosts

TEXT_FILE_MAX_BYTES = 256 * 1024


def _normalize_path_value(value: bytes | str | asyncssh_sftp.SFTPName) -> str:
    if isinstance(value, asyncssh_sftp.SFTPName):
        value = value.filename
    if isinstance(value, bytes):
        return value.decode("utf-8", errors="replace")
    return str(value or "")


def normalize_remote_name(name: str) -> str:
    value = str(name or "").strip()
    if not value or value in {".", ".."}:
        raise ValueError("Некорректное имя файла или папки")
    if "/" in value or "\\" in value:
        raise ValueError("Имя не должно содержать разделители пути")
    return value


def join_remote_path(parent_path: str, name: str) -> str:
    clean_name = normalize_remote_name(name)
    if parent_path == "/":
        return f"/{clean_name}"
    return posixpath.join(parent_path or ".", clean_name)


def _entry_kind(attrs: asyncssh.SFTPAttrs) -> str:
    entry_type = getattr(attrs, "type", asyncssh_sftp.FILEXFER_TYPE_UNKNOWN)
    permissions = getattr(attrs, "permissions", None)

    if entry_type == asyncssh_sftp.FILEXFER_TYPE_DIRECTORY:
        return "dir"
    if entry_type == asyncssh_sftp.FILEXFER_TYPE_SYMLINK:
        return "symlink"
    if entry_type == asyncssh_sftp.FILEXFER_TYPE_REGULAR:
        return "file"
    if permissions is not None and stat_module.S_ISDIR(permissions):
        return "dir"
    if permissions is not None and stat_module.S_ISLNK(permissions):
        return "symlink"
    return "file"


def _serialize_entry(path: str, name: str, attrs: asyncssh.SFTPAttrs) -> dict[str, Any]:
    kind = _entry_kind(attrs)
    permissions = getattr(attrs, "permissions", None)
    return {
        "name": name,
        "path": path,
        "kind": kind,
        "is_dir": kind == "dir",
        "is_symlink": kind == "symlink",
        "size": int(getattr(attrs, "size", 0) or 0),
        "permissions": stat_module.filemode(permissions) if isinstance(permissions, int) else "",
        "modified_at": int(getattr(attrs, "mtime", 0) or 0),
    }


@asynccontextmanager
async def open_server_sftp(server: Server, *, secret: str = "") -> AsyncIterator[asyncssh_sftp.SFTPClient]:
    known_hosts = await ensure_server_known_hosts(server)
    connect_kwargs = build_server_connect_kwargs(server, secret=secret, known_hosts=known_hosts)
    async with asyncssh.connect(**connect_kwargs) as conn:
        async with conn.start_sftp_client() as sftp:
            yield sftp


async def resolve_remote_path(sftp: asyncssh_sftp.SFTPClient, path: str | None) -> str:
    target = path or "."
    resolved = await sftp.realpath(target)
    return _normalize_path_value(resolved)


async def get_directory_listing(server: Server, *, secret: str = "", path: str | None = None) -> dict[str, Any]:
    async with open_server_sftp(server, secret=secret) as sftp:
        current_path = await resolve_remote_path(sftp, path)
        attrs = await sftp.stat(current_path)
        if _entry_kind(attrs) != "dir":
            raise NotADirectoryError(current_path)

        entries: list[dict[str, Any]] = []
        async for entry in sftp.scandir(current_path):
            name = _normalize_path_value(entry.filename)
            if not name or name in {".", ".."}:
                continue
            entry_path = join_remote_path(current_path, name)
            entries.append(_serialize_entry(entry_path, name, entry.attrs))

        entries.sort(key=lambda item: (not item["is_dir"], item["name"].lower()))
        home_path = await resolve_remote_path(sftp, ".")
        parent_path = None
        if current_path != "/":
            parent_candidate = posixpath.dirname(current_path.rstrip("/")) or "/"
            parent_path = parent_candidate if parent_candidate != current_path else None

        return {
            "path": current_path,
            "home_path": home_path,
            "parent_path": parent_path,
            "entries": entries,
        }


async def create_directory(server: Server, *, secret: str = "", parent_path: str | None, name: str) -> dict[str, Any]:
    async with open_server_sftp(server, secret=secret) as sftp:
        base_path = await resolve_remote_path(sftp, parent_path)
        target_path = join_remote_path(base_path, name)
        await sftp.mkdir(target_path)
        attrs = await sftp.stat(target_path)
        return {
            "path": base_path,
            "entry": _serialize_entry(target_path, normalize_remote_name(name), attrs),
        }


async def rename_path(server: Server, *, secret: str = "", path: str, new_name: str) -> dict[str, Any]:
    async with open_server_sftp(server, secret=secret) as sftp:
        source_path = await resolve_remote_path(sftp, path)
        parent_path = posixpath.dirname(source_path.rstrip("/")) or "/"
        target_name = normalize_remote_name(new_name)
        target_path = join_remote_path(parent_path, target_name)
        await sftp.rename(source_path, target_path)
        attrs = await sftp.stat(target_path)
        return {
            "path": parent_path,
            "entry": _serialize_entry(target_path, target_name, attrs),
        }


async def _remove_tree(sftp: asyncssh_sftp.SFTPClient, target_path: str) -> None:
    attrs = await sftp.lstat(target_path)
    if _entry_kind(attrs) != "dir":
        await sftp.remove(target_path)
        return

    async for entry in sftp.scandir(target_path):
        name = _normalize_path_value(entry.filename)
        if not name or name in {".", ".."}:
            continue
        await _remove_tree(sftp, join_remote_path(target_path, name))

    await sftp.rmdir(target_path)


async def delete_path(server: Server, *, secret: str = "", path: str, recursive: bool = False) -> dict[str, Any]:
    async with open_server_sftp(server, secret=secret) as sftp:
        target_path = await resolve_remote_path(sftp, path)
        parent_path = posixpath.dirname(target_path.rstrip("/")) or "/"
        attrs = await sftp.lstat(target_path)
        if _entry_kind(attrs) == "dir":
            if not recursive:
                raise IsADirectoryError(target_path)
            await _remove_tree(sftp, target_path)
        else:
            await sftp.remove(target_path)

        return {
            "path": parent_path,
            "deleted_path": target_path,
        }


async def upload_local_file(
    server: Server,
    *,
    secret: str = "",
    remote_dir: str | None,
    local_path: str,
    remote_name: str,
    overwrite: bool = False,
) -> dict[str, Any]:
    async with open_server_sftp(server, secret=secret) as sftp:
        target_dir = await resolve_remote_path(sftp, remote_dir)
        target_name = normalize_remote_name(remote_name)
        remote_path = join_remote_path(target_dir, target_name)
        if not overwrite and await sftp.exists(remote_path):
            raise FileExistsError(remote_path)

        await sftp.put(local_path, remote_path)
        attrs = await sftp.stat(remote_path)
        return {
            "path": target_dir,
            "entry": _serialize_entry(remote_path, target_name, attrs),
        }


async def download_file(
    server: Server,
    *,
    secret: str = "",
    path: str,
    spool_max_size: int = 8 * 1024 * 1024,
) -> dict[str, Any]:
    async with open_server_sftp(server, secret=secret) as sftp:
        target_path = await resolve_remote_path(sftp, path)
        attrs = await sftp.stat(target_path)
        if _entry_kind(attrs) == "dir":
            raise IsADirectoryError(target_path)

        local_file = SpooledTemporaryFile(max_size=spool_max_size, mode="w+b")
        async with sftp.open(target_path, "rb", encoding=None) as remote_file:
            while True:
                chunk = await remote_file.read(256 * 1024)
                if not chunk:
                    break
                local_file.write(chunk)

        local_file.seek(0)
        return {
            "path": target_path,
            "filename": posixpath.basename(target_path),
            "size": int(getattr(attrs, "size", 0) or 0),
            "file_obj": local_file,
        }


async def read_text_file(
    server: Server,
    *,
    secret: str = "",
    path: str,
    max_bytes: int = TEXT_FILE_MAX_BYTES,
) -> dict[str, Any]:
    async with open_server_sftp(server, secret=secret) as sftp:
        target_path = await resolve_remote_path(sftp, path)
        attrs = await sftp.stat(target_path)
        if _entry_kind(attrs) == "dir":
            raise IsADirectoryError(target_path)

        file_size = int(getattr(attrs, "size", 0) or 0)
        if file_size > max_bytes:
            raise ValueError(f"Файл слишком большой для редактора (>{max_bytes} bytes)")

        async with sftp.open(target_path, "rb", encoding=None) as remote_file:
            raw_content = await remote_file.read(max_bytes + 1)

        if len(raw_content) > max_bytes:
            raise ValueError(f"Файл слишком большой для редактора (>{max_bytes} bytes)")

        try:
            content = raw_content.decode("utf-8")
        except UnicodeDecodeError as exc:
            raise ValueError("Файл не является UTF-8 текстом") from exc

        return {
            "path": target_path,
            "filename": posixpath.basename(target_path),
            "size": file_size,
            "encoding": "utf-8",
            "content": content,
        }


async def write_text_file(
    server: Server,
    *,
    secret: str = "",
    path: str,
    content: str,
    max_bytes: int = TEXT_FILE_MAX_BYTES,
) -> dict[str, Any]:
    async with open_server_sftp(server, secret=secret) as sftp:
        target_path = await resolve_remote_path(sftp, path)
        attrs = await sftp.stat(target_path)
        if _entry_kind(attrs) == "dir":
            raise IsADirectoryError(target_path)

        payload = str(content or "").encode("utf-8")
        if len(payload) > max_bytes:
            raise ValueError(f"Файл слишком большой для сохранения через редактор (>{max_bytes} bytes)")

        async with sftp.open(target_path, "wb", encoding=None) as remote_file:
            await remote_file.write(payload)

        updated_attrs = await sftp.stat(target_path)
        return {
            "path": target_path,
            "filename": posixpath.basename(target_path),
            "size": int(getattr(updated_attrs, "size", 0) or 0),
            "encoding": "utf-8",
            "content": str(content or ""),
        }
