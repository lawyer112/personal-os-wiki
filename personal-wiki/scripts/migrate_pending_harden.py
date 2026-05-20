#!/usr/bin/env python3
from __future__ import annotations

import argparse
from dataclasses import dataclass
from pathlib import Path
import shutil


@dataclass(frozen=True)
class PendingMove:
    src: Path
    target: Path
    rel_src: str
    rel_target: str


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Move pending-harden atom/skill notes into Harden paths.")
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--dry-run", action="store_true")
    mode.add_argument("--apply", action="store_true")
    parser.add_argument("--yes", action="store_true")
    parser.add_argument("--vault", type=Path, default=Path(__file__).resolve().parents[1] / "data" / "vault")
    args = parser.parse_args(argv)

    if args.apply and not args.yes:
        raise SystemExit("--apply requires --yes")
    moves = build_plan(args.vault.resolve())
    for move in moves:
        print(f"PLAN {move.rel_src} -> {move.rel_target}")
    if args.apply:
        for move in moves:
            move_one(move)
    return 0


def build_plan(vault: Path) -> list[PendingMove]:
    pairs = [
        (vault / "90_archive" / "pending-harden" / "atom", vault / "20_atoms"),
        (vault / "90_archive" / "pending-harden" / "skill", vault / "50_skills"),
    ]
    moves = []
    for source_root, target_root in pairs:
        if not source_root.exists():
            continue
        for src in sorted(source_root.glob("*.md")):
            target = unique_target(target_root / src.name)
            moves.append(
                PendingMove(
                    src=src,
                    target=target,
                    rel_src=src.relative_to(vault).as_posix(),
                    rel_target=target.relative_to(vault).as_posix(),
                )
            )
    return moves


def unique_target(target: Path) -> Path:
    if not target.exists():
        return target
    base = target.with_suffix("")
    for index in range(2, 1000):
        candidate = Path(f"{base}-r{index}{target.suffix}")
        if not candidate.exists():
            return candidate
    raise RuntimeError(f"Cannot find unique target for {target}")


def move_one(move: PendingMove) -> None:
    move.target.parent.mkdir(parents=True, exist_ok=True)
    shutil.move(str(move.src), str(move.target))


if __name__ == "__main__":
    raise SystemExit(main())
