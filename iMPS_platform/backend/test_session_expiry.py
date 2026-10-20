from datetime import datetime, timedelta, timezone

from session_expiry import SESSION_TZ, access_token_ttl


def bkk(y, mo, d, h, mi=0):
    return datetime(y, mo, d, h, mi, tzinfo=SESSION_TZ)


def expires_at(now):
    return (now + access_token_ttl(now)).astimezone(SESSION_TZ)


def test_login_morning_expires_next_3am():
    assert expires_at(bkk(2026, 10, 20, 9)) == bkk(2026, 10, 21, 3)


def test_login_after_midnight_before_3am_with_time_left():
    assert expires_at(bkk(2026, 10, 21, 1, 0)) == bkk(2026, 10, 21, 3)


def test_login_close_to_3am_gets_next_night():
    assert expires_at(bkk(2026, 10, 21, 2, 30)) == bkk(2026, 10, 22, 3)


def test_login_exactly_3am_gets_next_night():
    assert expires_at(bkk(2026, 10, 21, 3, 0)) == bkk(2026, 10, 22, 3)


def test_lifetime_bounds_and_utc_input():
    now = datetime(2026, 10, 20, 2, 0, tzinfo=timezone.utc)  # 09:00 ไทย
    ttl = access_token_ttl(now)
    assert ttl == timedelta(hours=18)
    for h in range(24):
        for m in (0, 15, 59):
            t = access_token_ttl(bkk(2026, 10, 20, h, m))
            assert timedelta(hours=1) <= t <= timedelta(hours=25)


def test_naive_datetime_is_treated_as_utc():
    assert access_token_ttl(datetime(2026, 10, 20, 2, 0)) == timedelta(hours=18)


if __name__ == "__main__":
    _tests = [(n, f) for n, f in list(globals().items()) if n.startswith("test_") and callable(f)]
    for _name, _fn in _tests:
        _fn()
        print("[PASS]", _name)
    print(f"{len(_tests)} passed")
