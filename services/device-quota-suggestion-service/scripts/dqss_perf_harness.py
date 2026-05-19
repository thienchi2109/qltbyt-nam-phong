#!/usr/bin/env python3
import argparse
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from app.perf_harness import run_deterministic_case


def main() -> None:
    parser = argparse.ArgumentParser(description="Run DQSS large-payload smoke cases.")
    parser.add_argument(
        "--case",
        choices=("unit17", "synthetic-2000"),
        default="unit17",
    )
    parser.add_argument(
        "--mode",
        choices=("deterministic",),
        default="deterministic",
    )
    args = parser.parse_args()

    print(
        json.dumps(
            run_deterministic_case(args.case),
            ensure_ascii=False,
            sort_keys=True,
        )
    )


if __name__ == "__main__":
    main()
