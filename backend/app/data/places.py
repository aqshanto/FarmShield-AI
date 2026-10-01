"""Divisions and districts of Bangladesh, with the location of each headquarters town.

Used to name a farmer's field ("near Bogura, Rajshahi division") and for the district
picker. Coordinates are the district towns (±~5 km), not boundaries, so a field is
described as *near* its closest district town.
"""

from dataclasses import dataclass
from math import asin, cos, radians, sin, sqrt


@dataclass(frozen=True)
class Place:
    name: str
    name_bn: str
    lat: float
    lon: float
    division: str = ""


DIVISIONS: dict[str, Place] = {
    p.name: p
    for p in [
        Place("Dhaka", "ঢাকা", 23.81, 90.41),
        Place("Mymensingh", "ময়মনসিংহ", 24.75, 90.41),
        Place("Chattogram", "চট্টগ্রাম", 22.36, 91.78),
        Place("Rajshahi", "রাজশাহী", 24.37, 88.60),
        Place("Rangpur", "রংপুর", 25.74, 89.25),
        Place("Khulna", "খুলনা", 22.82, 89.55),
        Place("Barishal", "বরিশাল", 22.70, 90.35),
        Place("Sylhet", "সিলেট", 24.90, 91.87),
    ]
}

_D = Place
DISTRICTS: list[Place] = [
    # Dhaka division
    _D("Dhaka", "ঢাকা", 23.81, 90.41, "Dhaka"),
    _D("Gazipur", "গাজীপুর", 24.00, 90.42, "Dhaka"),
    _D("Narayanganj", "নারায়ণগঞ্জ", 23.62, 90.50, "Dhaka"),
    _D("Narsingdi", "নরসিংদী", 23.92, 90.72, "Dhaka"),
    _D("Manikganj", "মানিকগঞ্জ", 23.86, 90.00, "Dhaka"),
    _D("Munshiganj", "মুন্সীগঞ্জ", 23.54, 90.53, "Dhaka"),
    _D("Tangail", "টাঙ্গাইল", 24.25, 89.92, "Dhaka"),
    _D("Kishoreganj", "কিশোরগঞ্জ", 24.43, 90.78, "Dhaka"),
    _D("Faridpur", "ফরিদপুর", 23.61, 89.84, "Dhaka"),
    _D("Rajbari", "রাজবাড়ী", 23.76, 89.64, "Dhaka"),
    _D("Gopalganj", "গোপালগঞ্জ", 23.01, 89.83, "Dhaka"),
    _D("Madaripur", "মাদারীপুর", 23.17, 90.20, "Dhaka"),
    _D("Shariatpur", "শরীয়তপুর", 23.21, 90.35, "Dhaka"),
    # Mymensingh division
    _D("Mymensingh", "ময়মনসিংহ", 24.75, 90.41, "Mymensingh"),
    _D("Jamalpur", "জামালপুর", 24.92, 89.95, "Mymensingh"),
    _D("Sherpur", "শেরপুর", 25.02, 90.02, "Mymensingh"),
    _D("Netrokona", "নেত্রকোণা", 24.88, 90.73, "Mymensingh"),
    # Chattogram division
    _D("Chattogram", "চট্টগ্রাম", 22.36, 91.78, "Chattogram"),
    _D("Cox's Bazar", "কক্সবাজার", 21.43, 92.01, "Chattogram"),
    _D("Rangamati", "রাঙ্গামাটি", 22.65, 92.18, "Chattogram"),
    _D("Bandarban", "বান্দরবান", 22.20, 92.22, "Chattogram"),
    _D("Khagrachhari", "খাগড়াছড়ি", 23.12, 91.98, "Chattogram"),
    _D("Feni", "ফেনী", 23.02, 91.40, "Chattogram"),
    _D("Noakhali", "নোয়াখালী", 22.87, 91.10, "Chattogram"),
    _D("Lakshmipur", "লক্ষ্মীপুর", 22.94, 90.83, "Chattogram"),
    _D("Chandpur", "চাঁদপুর", 23.23, 90.67, "Chattogram"),
    _D("Cumilla", "কুমিল্লা", 23.46, 91.18, "Chattogram"),
    _D("Brahmanbaria", "ব্রাহ্মণবাড়িয়া", 23.96, 91.11, "Chattogram"),
    # Rajshahi division
    _D("Rajshahi", "রাজশাহী", 24.37, 88.60, "Rajshahi"),
    _D("Chapainawabganj", "চাঁপাইনবাবগঞ্জ", 24.60, 88.27, "Rajshahi"),
    _D("Naogaon", "নওগাঁ", 24.80, 88.93, "Rajshahi"),
    _D("Natore", "নাটোর", 24.42, 89.00, "Rajshahi"),
    _D("Bogura", "বগুড়া", 24.85, 89.37, "Rajshahi"),
    _D("Joypurhat", "জয়পুরহাট", 25.10, 89.02, "Rajshahi"),
    _D("Pabna", "পাবনা", 24.01, 89.23, "Rajshahi"),
    _D("Sirajganj", "সিরাজগঞ্জ", 24.45, 89.70, "Rajshahi"),
    # Rangpur division
    _D("Rangpur", "রংপুর", 25.74, 89.25, "Rangpur"),
    _D("Dinajpur", "দিনাজপুর", 25.63, 88.64, "Rangpur"),
    _D("Thakurgaon", "ঠাকুরগাঁও", 26.03, 88.46, "Rangpur"),
    _D("Panchagarh", "পঞ্চগড়", 26.34, 88.55, "Rangpur"),
    _D("Nilphamari", "নীলফামারী", 25.93, 88.86, "Rangpur"),
    _D("Lalmonirhat", "লালমনিরহাট", 25.92, 89.45, "Rangpur"),
    _D("Kurigram", "কুড়িগ্রাম", 25.81, 89.64, "Rangpur"),
    _D("Gaibandha", "গাইবান্ধা", 25.33, 89.53, "Rangpur"),
    # Khulna division
    _D("Khulna", "খুলনা", 22.82, 89.55, "Khulna"),
    _D("Jashore", "যশোর", 23.17, 89.21, "Khulna"),
    _D("Satkhira", "সাতক্ষীরা", 22.72, 89.07, "Khulna"),
    _D("Bagerhat", "বাগেরহাট", 22.65, 89.79, "Khulna"),
    _D("Narail", "নড়াইল", 23.17, 89.51, "Khulna"),
    _D("Magura", "মাগুরা", 23.49, 89.42, "Khulna"),
    _D("Jhenaidah", "ঝিনাইদহ", 23.54, 89.17, "Khulna"),
    _D("Kushtia", "কুষ্টিয়া", 23.90, 89.12, "Khulna"),
    _D("Chuadanga", "চুয়াডাঙ্গা", 23.64, 88.84, "Khulna"),
    _D("Meherpur", "মেহেরপুর", 23.76, 88.63, "Khulna"),
    # Barishal division
    _D("Barishal", "বরিশাল", 22.70, 90.35, "Barishal"),
    _D("Patuakhali", "পটুয়াখালী", 22.36, 90.33, "Barishal"),
    _D("Bhola", "ভোলা", 22.69, 90.65, "Barishal"),
    _D("Pirojpur", "পিরোজপুর", 22.58, 89.97, "Barishal"),
    _D("Jhalokati", "ঝালকাঠি", 22.64, 90.20, "Barishal"),
    _D("Barguna", "বরগুনা", 22.15, 90.12, "Barishal"),
    # Sylhet division
    _D("Sylhet", "সিলেট", 24.90, 91.87, "Sylhet"),
    _D("Moulvibazar", "মৌলভীবাজার", 24.48, 91.78, "Sylhet"),
    _D("Habiganj", "হবিগঞ্জ", 24.38, 91.42, "Sylhet"),
    _D("Sunamganj", "সুনামগঞ্জ", 25.07, 91.40, "Sylhet"),
]


def distance_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    d_lat, d_lon = radians(lat2 - lat1), radians(lon2 - lon1)
    a = sin(d_lat / 2) ** 2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(d_lon / 2) ** 2
    return 6371 * 2 * asin(sqrt(a))


def nearest_district(lat: float, lon: float) -> tuple[Place, float]:
    """The closest district town and its distance in km."""
    best = min(DISTRICTS, key=lambda d: distance_km(lat, lon, d.lat, d.lon))
    return best, distance_km(lat, lon, best.lat, best.lon)
