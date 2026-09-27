"""ทำความสะอาดยอดขายจาก POS ของบ้านบรู เรียกครั้งเดียวได้ไฟล์สะอาด

    from clean_sales import clean_sales
    clean, cleaning_log = clean_sales("sales_raw.csv", out="sales_clean.csv")
    sales = add_date_hour(clean)   # เพิ่มคอลัมน์ date และ hour สำหรับวิเคราะห์ต่อ
"""
import pandas as pd

COLUMNS = ["order_id", "datetime", "branch", "product_id", "qty", "unit_price",
           "customer_id", "payment_method", "channel"]
STD_BRANCHES = ["สยาม", "สีลม", "อารีย์", "บางนา", "มหาวิทยาลัย"]
BRANCH_MAP = {
    "Siam": "สยาม", "สาขาสยาม": "สยาม",
    "Silom": "สีลม",
    "Ari": "อารีย์", "อารีย": "อารีย์",
    "Bangna": "บางนา",
    "มหาลัย": "มหาวิทยาลัย", "ม.": "มหาวิทยาลัย",
}
# แยกส่วนด้วย regex เอง ไม่ใช้ pd.to_datetime() เพราะอาจสลับวัน/เดือน และแปลงเป็น UTC
ISO = r"^(?P<y>\d{4})-(?P<m>\d\d)-(?P<d>\d\d)T(?P<H>\d\d):(?P<M>\d\d):(?P<S>\d\d)(?:\+07:00)?$"
DMY = r"^(?P<d>\d\d)/(?P<m>\d\d)/(?P<y>\d{4}) (?P<H>\d\d):(?P<M>\d\d)(?::(?P<S>\d\d))?$"


def _fix_datetime(s):
    """คืน (datetime ที่แปลงแล้ว, จำนวนแถวแต่ละแบบ) รูปแบบ YYYY-MM-DDTHH:MM:SS+07:00 ปี ค.ศ."""
    s = s.str.strip()
    iso = s.str.extract(ISO)
    parts = iso.fillna(s.str.extract(DMY))
    unparsed = parts["y"].isna()
    if unparsed.any():
        raise ValueError(f"datetime รูปแบบที่ไม่รู้จัก {unparsed.sum()} แถว เช่น {s[unparsed].head().tolist()}")

    year = parts["y"].astype(int)
    is_be = year > 2400                                   # ปี พ.ศ.
    year = year.where(~is_be, year - 543)
    sec = parts["S"].fillna("00")                         # DD/MM/YYYY ไม่มีวินาที → 00
    fixed = (year.astype(str) + "-" + parts["m"] + "-" + parts["d"] + "T"
             + parts["H"] + ":" + parts["M"] + ":" + sec + "+07:00")

    is_dmy = iso["y"].isna()
    counts = {"iso_be": (~is_dmy & is_be).sum(), "dmy_ce": (is_dmy & ~is_be).sum(),
              "dmy_be": (is_dmy & is_be).sum()}
    return fixed, counts


def clean_sales(path, out=None):
    """อ่าน sales_raw.csv แล้วคืน (clean, cleaning_log) ถ้าใส่ out จะบันทึก CSV ทั้งสองไฟล์ด้วย

    out="sales_clean.csv" → บันทึก sales_clean.csv และ sales_clean_log.csv
    """
    df = pd.read_csv(path, dtype=str, keep_default_na=False)
    missing = [c for c in COLUMNS if c not in df.columns]
    if missing:
        raise ValueError(f"ไฟล์ {path} ขาดคอลัมน์ {missing}")

    clean = df[COLUMNS].copy()
    log = []

    def add_log(step, n, decision):
        log.append({"ขั้นตอน": step, "จำนวนแถวที่กระทบ": int(n), "การตัดสินใจ": decision})

    # 1) แถวซ้ำทุกคอลัมน์ (ไม่ใช้ order_id อย่างเดียว เพราะ 1 บิลมีหลายแถว)
    dup = clean.duplicated(keep="first")
    clean = clean[~dup]
    add_log("ลบแถวซ้ำทุกคอลัมน์", dup.sum(), "ลบ เก็บแถวแรกไว้")

    # 2) datetime
    clean["datetime"], n = _fix_datetime(clean["datetime"])
    add_log("datetime ISO ปี พ.ศ. → ค.ศ.", n["iso_be"], "แปลง ลบ 543 ปี")
    add_log("datetime DD/MM/YYYY ปี ค.ศ. → ISO", n["dmy_ce"], "แปลง ใส่วินาที 00")
    add_log("datetime DD/MM/YYYY ปี พ.ศ. → ISO", n["dmy_be"], "แปลง ลบ 543 ปี และใส่วินาที 00")

    # 3) ชื่อสาขา: strip ก่อน แล้ว map
    branch = clean["branch"].str.strip().replace(BRANCH_MAP)
    unknown = ~branch.isin(STD_BRANCHES)
    if unknown.any():
        raise ValueError(f"ชื่อสาขาที่ยังไม่มีใน BRANCH_MAP: {branch[unknown].unique().tolist()}")
    add_log("ชื่อสาขา strip + map เป็น 5 ชื่อมาตรฐาน", (clean["branch"] != branch).sum(), "แก้ชื่อ")
    clean["branch"] = branch

    # 4) unit_price: ตัด "บาท" แปลงเป็นตัวเลข ราคาติดลบเปลี่ยนเป็นบวก
    raw_price = clean["unit_price"].str.strip()
    price = pd.to_numeric(raw_price.str.replace("บาท", "", regex=False).str.strip(), errors="coerce")
    if price.isna().any():
        raise ValueError(f"unit_price ที่ยังแปลงไม่ได้: {raw_price[price.isna()].unique().tolist()}")
    add_log("unit_price ตัดคำว่า 'บาท'", raw_price.str.contains("บาท").sum(), "แปลงเป็นตัวเลข")
    add_log("unit_price ติดลบ", (price < 0).sum(), "เปลี่ยนเป็นค่าบวก (เครื่องหมายลบพิมพ์ผิด)")
    clean["unit_price"] = price.abs().round().astype(int).astype(str)

    # 5) qty = 0 และ product_id ว่าง
    qty = pd.to_numeric(clean["qty"], errors="coerce")
    if qty.isna().any():
        raise ValueError(f"qty ที่แปลงเป็นตัวเลขไม่ได้: {clean.loc[qty.isna(), 'qty'].unique().tolist()}")
    qty_zero = qty == 0
    clean = clean[~qty_zero]
    add_log("ลบแถว qty = 0", qty_zero.sum(), "ลบ")

    no_product = clean["product_id"].str.strip() == ""
    clean = clean[~no_product]
    add_log("ลบแถว product_id ว่าง", no_product.sum(), "ลบ")

    clean = clean.reset_index(drop=True)
    cleaning_log = pd.DataFrame(log)
    cleaning_log.loc[len(cleaning_log)] = ["สรุป: แถวก่อน → หลัง", len(df) - len(clean),
                                           f"{len(df):,} → {len(clean):,}"]

    if out:
        clean.to_csv(out, index=False, encoding="utf-8-sig")
        log_path = out[:-4] + "_log.csv" if out.endswith(".csv") else out + "_log.csv"
        cleaning_log.to_csv(log_path, index=False, encoding="utf-8-sig")
    return clean, cleaning_log


def add_date_hour(clean):
    """คืนสำเนาของ clean ที่เพิ่มคอลัมน์ date (YYYY-MM-DD) และ hour (0–23) ตามเวลาไทย

    แปลงผ่าน timezone Asia/Bangkok จริง แล้วเทียบกับวันเวลาที่เขียนไว้ในข้อความ
    ถ้าไม่ตรงกันแม้แถวเดียว (วันที่เลื่อนเพราะ timezone) จะหยุดทันที
    """
    out = clean.copy()
    local = pd.to_datetime(out["datetime"], format="%Y-%m-%dT%H:%M:%S%z", utc=True).dt.tz_convert("Asia/Bangkok")
    out["date"] = local.dt.strftime("%Y-%m-%d")
    out["hour"] = local.dt.hour

    # ตรวจ: datetime ทุกแถวเป็น +07:00 ดังนั้นวันและชั่วโมงต้องตรงกับตัวอักษรในข้อความ
    shifted_date = out["date"] != out["datetime"].str[:10]
    shifted_hour = out["hour"] != out["datetime"].str[11:13].astype(int)
    if shifted_date.any() or shifted_hour.any():
        raise ValueError(f"date/hour เลื่อนเพราะ timezone: วันที่ {shifted_date.sum()} แถว "
                         f"ชั่วโมง {shifted_hour.sum()} แถว เช่น {out.loc[shifted_date | shifted_hour, 'datetime'].head().tolist()}")
    return out


if __name__ == "__main__":
    import sys
    if len(sys.argv) not in (2, 3):
        sys.exit("ใช้: python clean_sales.py sales_raw.csv [sales_clean.csv]")
    clean, cleaning_log = clean_sales(sys.argv[1], out=sys.argv[2] if len(sys.argv) == 3 else None)
    print(cleaning_log.to_string(index=False))
