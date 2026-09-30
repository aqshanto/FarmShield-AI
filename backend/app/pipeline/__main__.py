"""Command line: refresh NASA data for all farms (e.g. from cron / Task Scheduler).

    python -m app.pipeline refresh [--days 60] [--force]
    python -m app.pipeline status
"""

import argparse
import asyncio
import logging

from app.pipeline import farm_locations, get_pipeline


def main() -> None:
    parser = argparse.ArgumentParser(prog="python -m app.pipeline")
    commands = parser.add_subparsers(dest="command", required=True)
    refresh = commands.add_parser("refresh", help="download new NASA data for every farm")
    refresh.add_argument("--days", type=int, default=60)
    refresh.add_argument("--force", action="store_true", help="ignore cache freshness")
    commands.add_parser("status", help="show the state of each source")
    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    pipeline = get_pipeline()

    if args.command == "refresh":
        results = asyncio.run(pipeline.refresh(farm_locations(), days=args.days, force=args.force))
        for r in results:
            print(f"{r.source:<11} {r.location:<16} {r.status:<11} {r.count:>4}  {r.message or ''}")
    else:
        for s in pipeline.source_status():
            print(f"{s['mission']:<6} {s['id']:<11} {s['state']:<11} {s['observations']:>5} obs  last ok: {s['last_success']}")


if __name__ == "__main__":
    main()
