from __future__ import annotations

import datetime as dt


WIKI_TIME_ZONE = dt.timezone(dt.timedelta(hours=8), "Asia/Shanghai")


def parse_timestamp(value: str) -> dt.datetime:
    parsed = dt.datetime.fromisoformat(value.replace("Z", "+00:00"))
    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=dt.timezone.utc)
    return parsed


def to_wiki_datetime(value: str) -> dt.datetime:
    return parse_timestamp(value).astimezone(WIKI_TIME_ZONE)