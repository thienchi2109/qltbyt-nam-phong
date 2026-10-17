# Backlog.md trên VPS này

## Phạm vi

Runbook này áp dụng cho VPS hiện tại của `/root/qltbyt-nam-phong`. VPS đang
expose `QEMU Virtual CPU version 2.5+` và không có CPU flag `sse4_2`.

Backlog.md bản npm cài tại `~/.local` dùng native Linux binary dựa trên Bun.
Bản phát hành này yêu cầu SSE4.2, vì vậy `backlog` không khởi động được trên
CPU profile hiện tại. Đây là giới hạn CPU ảo, không phải lỗi cài đặt dự án.

## Kiểm tra trước khi dùng

```bash
lscpu | sed -n '/^Model name:/p'
grep -m1 -o 'sse4_2' /proc/cpuinfo || true
timeout 5s backlog --version
```

Nếu không có `sse4_2`, không chạy lại `backlog`, `npx backlog.md`, `bun`, hoặc
`nix run` để thử workaround trên cùng VPS; các đường đó vẫn cần runtime native
tương thích CPU.

## Quy trình vận hành hiện tại

Backlog được quản lý thủ công bằng Markdown trong repo:

- Đặt task dưới `backlog/tasks/` và lưu mọi thay đổi bằng Git.
- Giữ nội dung task, acceptance criteria, trạng thái, milestone, và dependency
  ở dạng Markdown để agent/người có thể review trực tiếp.
- Không phụ thuộc vào `backlog board`, `backlog task`, MCP server, hay các lệnh
  CLI khác khi làm việc trên VPS này.

Gói npm có thể vẫn tồn tại ở `~/.local`, nhưng không được coi là đã hoạt động
cho đến khi lệnh kiểm tra ở trên chạy thành công.

## Khi CPU profile được nâng cấp

Sau khi nhà cung cấp VPS expose SSE4.2 trở lên (ví dụ CPU model Haswell hoặc
`host-passthrough`) và VPS đã reboot:

```bash
grep -m1 -o 'sse4_2' /proc/cpuinfo
npm install --prefix "$HOME/.local" -g backlog.md
hash -r
backlog --version
```

Chỉ sau khi kiểm tra phiên bản thành công mới dùng `backlog init`, `backlog
board`, hoặc các lệnh CLI khác.

## Nguồn

- [Backlog.md](https://github.com/MrLesk/Backlog.md)
- README của gói cài đặt nêu SSE4.2 là yêu cầu tối thiểu cho Linux x86_64.
