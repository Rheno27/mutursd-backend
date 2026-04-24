from pathlib import Path

p = Path(r"mutursd-backend/src/endpoints/mutu/download-rekap.ts")
lines = p.read_text(encoding="utf-8").splitlines()
start = 140
end = 152
for i in range(start - 1, min(end, len(lines))):
    print(f"{i + 1}: {lines[i]}")
