"""
Seed script สำหรับเพิ่มข้อมูล demo ในฐานข้อมูล
รันไฟล์นี้เพื่อสร้างผู้ใช้และสินค้าตัวอย่าง
"""
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from dotenv import load_dotenv
load_dotenv()


from app import create_app
from app.constants import DEFAULT_LOCATIONS, PRODUCT_CATEGORIES, PRODUCT_CONDITIONS
from app.models import (
    db,
    BuyerProtectionClaim,
    ChatMessage,
    Conversation,
    Favorite,
    ModerationLog,
    Order,
    Product,
    Review,
    SellerReview,
    User,
)

def seed_app():
    app = create_app('development')

    with app.app_context():
        # Clear existing data
        print("🗑️ ล้างข้อมูลเดิม...")
        for model in (
            ChatMessage,
            Conversation,
            BuyerProtectionClaim,
            SellerReview,
            Order,
            Favorite,
            Review,
            ModerationLog,
            Product,
            User,
        ):
            db.session.query(model).delete()
        db.session.commit()

        # Create test users
        print("👥 สร้างผู้ใช้ตัวอย่าง...")
        users_data = [
            {
                'username': 'seller_peet',
                'email': 'peet@example.com',
                'password': 'password123',
                'full_name': 'คุณพีท',
                'location': DEFAULT_LOCATIONS[0],
                'user_type': 'seller',
                'phone': '089-123-4567'
            },
            {
                'username': 'seller_ping',
                'email': 'ping@example.com',
                'password': 'password123',
                'full_name': 'ช่างปิง',
                'location': DEFAULT_LOCATIONS[1],
                'user_type': 'seller',
                'phone': '081-987-6543'
            },
            {
                'username': 'buyer_demo',
                'email': 'buyer@example.com',
                'password': 'password123',
                'full_name': 'ผู้ซื้อทดลอง',
                'location': DEFAULT_LOCATIONS[0],
                'user_type': 'buyer',
                'phone': '082-555-1234'
            }
        ]

        users = []
        for user_data in users_data:
            user = User(
                username=user_data['username'],
                email=user_data['email'],
                full_name=user_data['full_name'],
                location=user_data['location'],
                user_type=user_data['user_type'],
                phone=user_data['phone'],
                is_verified=True,
                rating=4.9
            )
            user.set_password(user_data['password'])
            users.append(user)
            db.session.add(user)

        db.session.commit()
        print(f"✅ สร้างผู้ใช้ {len(users)} คน")

        # Create sample products
        print("📦 สร้างสินค้าตัวอย่าง...")
        products_data = [
            {
                'title': 'ASUS ROG Strix RTX 4080 OC',
                'price': 42900,
                'category': PRODUCT_CATEGORIES[0],
                'condition': PRODUCT_CONDITIONS[1],
                'location': DEFAULT_LOCATIONS[0],
                'warranty': 'เหลือ 10 เดือน',
                'seller_id': users[0].id,
                'specs': ['10GB GDDR6X', 'พร้อมใบเสร็จ', 'ใช้น้อย'],
                'description': 'สภาพไร้ฝุ่น ล้างซิลิโคนใหม่ แถมสายไฟ 2 ชุด',
                'image_url': 'https://picsum.photos/seed/rtx4080/900/600',
                'rating': 4.9,
                'total_reviews': 8,
            },
            {
                'title': 'NZXT Custom Loop Gaming PC',
                'price': 58900,
                'category': PRODUCT_CATEGORIES[1],
                'condition': PRODUCT_CONDITIONS[1],
                'location': DEFAULT_LOCATIONS[1],
                'warranty': 'รับประกันร้าน 8 เดือน',
                'seller_id': users[1].id,
                'specs': ['Ryzen 9 7950X', 'RTX 4090 FE', 'น้ำปิด Custom'],
                'description': 'เครื่องพร้อมใช้งาน ทำความสะอาดและ Burn-in แล้ว',
                'image_url': 'https://picsum.photos/seed/nzxtpc/900/600',
                'rating': 4.8,
                'total_reviews': 12,
            },
            {
                'title': 'Sony INZONE M9 4K 144Hz',
                'price': 22900,
                'category': PRODUCT_CATEGORIES[4],
                'condition': PRODUCT_CONDITIONS[2],
                'location': DEFAULT_LOCATIONS[2],
                'warranty': 'ถึง พ.ย. 2025',
                'seller_id': users[0].id,
                'specs': ['27 นิ้ว 4K HDR', 'USB-C', 'Local Dimming'],
                'description': 'จอไม่ติด Dead pixel มีขาตั้งครบ',
                'image_url': 'https://picsum.photos/seed/sonyinzone/900/600',
                'rating': 4.7,
                'total_reviews': 5,
            },
            {
                'title': 'Keychron Q1 Max พร้อม Keycap GMK',
                'price': 8900,
                'category': PRODUCT_CATEGORIES[3],
                'condition': PRODUCT_CONDITIONS[1],
                'location': DEFAULT_LOCATIONS[0],
                'warranty': 'เหลือ 11 เดือน',
                'seller_id': users[1].id,
                'specs': ['Switch Silent Tactile', 'Foam Mod ครบ', 'แถมสายถัก'],
                'description': 'ประกอบเอง โทนเสียงนุ่ม พร้อมดอง 3 โปรไฟล์',
                'image_url': 'https://picsum.photos/seed/keychron/900/600',
                'rating': 4.95,
                'total_reviews': 15,
            },
            {
                'title': 'Samsung 980 Pro 2TB + Heatsink',
                'price': 6800,
                'category': PRODUCT_CATEGORIES[5],
                'condition': PRODUCT_CONDITIONS[0],
                'location': DEFAULT_LOCATIONS[3],
                'warranty': 'ศูนย์ 5 ปี',
                'seller_id': users[0].id,
                'specs': ['อ่าน 7,000MB/s', 'TBW 1,200', 'รองรับ PS5'],
                'description': 'ยังไม่ลงทะเบียน สามารถส่ง EMS ฟรี',
                'image_url': 'https://picsum.photos/seed/samsung980/900/600',
                'rating': 4.85,
                'total_reviews': 7,
            },
            {
                'title': 'Corsair Virtuoso Wireless SE',
                'price': 5900,
                'category': PRODUCT_CATEGORIES[3],
                'condition': PRODUCT_CONDITIONS[2],
                'location': DEFAULT_LOCATIONS[4],
                'warranty': 'ร้าน 6 เดือน',
                'seller_id': users[1].id,
                'specs': ['7.1 Surround', 'แบต 18 ชม.', 'พร้อมเคส'],
                'description': 'ใช้งานในสตูดิโอ เสียงไม่มีเบี้ยว',
                'image_url': 'https://picsum.photos/seed/corsair/900/600',
                'rating': 4.6,
                'total_reviews': 9,
            },
            {
                'title': 'LG UltraGear 34\'\' QHD 160Hz',
                'price': 24900,
                'category': PRODUCT_CATEGORIES[4],
                'condition': PRODUCT_CONDITIONS[2],
                'location': DEFAULT_LOCATIONS[2],
                'warranty': 'ถึง ก.ย. 2025',
                'seller_id': users[0].id,
                'specs': ['Nano IPS', 'HDR600', 'Curve 800R'],
                'description': 'ไม่มีรอย กรอบอลูมิเนียม แขวนผนังได้',
                'image_url': 'https://picsum.photos/seed/lgultra/900/600',
                'rating': 4.7,
                'total_reviews': 6,
            },
                        # ── Graphics Cards ──
            {
                'title': 'ASUS ROG Strix RTX 4080 OC',
                'price': 42900,
                'category': PRODUCT_CATEGORIES[0],
                'condition': PRODUCT_CONDITIONS[1],
                'location': DEFAULT_LOCATIONS[0],
                'warranty': 'เหลือ 10 เดือน',
                'seller_id': users[0].id,
                'specs': ['16GB GDDR6X', 'พร้อมใบเสร็จ', 'ใช้น้อย'],
                'description': 'สภาพไร้ฝุ่น ล้างซิลิโคนใหม่ แถมสายไฟ 2 ชุด เหมาะกับเล่นเกม 4K',
                'rating': 4.9,
                'total_reviews': 8,
            },
            {
                'title': 'MSI RTX 4070 Ventus 3X',
                'price': 19500,
                'category': PRODUCT_CATEGORIES[0],
                'condition': PRODUCT_CONDITIONS[1],
                'location': DEFAULT_LOCATIONS[1],
                'warranty': 'เหลือ 16 เดือน',
                'seller_id': users[1].id,
                'specs': ['12GB GDDR6X', 'พัดลม 3 ตัว', 'อุณหภูมิเย็น'],
                'description': 'การ์ดจอเล่นเกม 1440p คุ้มค่า ทำงานเงียบ เย็น ใช้ในเครื่องสำรอง',
                'rating': 4.8,
                'total_reviews': 6,
            },
            {
                'title': 'Gigabyte RTX 3060 Ti',
                'price': 9900,
                'category': PRODUCT_CATEGORIES[0],
                'condition': PRODUCT_CONDITIONS[2],
                'location': DEFAULT_LOCATIONS[2],
                'warranty': 'none',
                'seller_id': users[0].id,
                'specs': ['8GB GDDR6', 'รองรับ Ray Tracing', 'เล่น 1080p ลื่น'],
                'description': 'การ์ดจอราคาประหยัด เหมาะสำหรับผู้เริ่มต้นเล่นเกมหรือสตรีม',
                'rating': 4.6,
                'total_reviews': 11,
            },

            # ── Full PC builds ──
            {
                'title': 'NZXT Custom Loop Gaming PC',
                'price': 58900,
                'category': PRODUCT_CATEGORIES[1],
                'condition': PRODUCT_CONDITIONS[1],
                'location': DEFAULT_LOCATIONS[1],
                'warranty': 'รับประกันร้าน 8 เดือน',
                'seller_id': users[1].id,
                'specs': ['Ryzen 9 7950X', 'RTX 4090 FE', 'น้ำปิด Custom'],
                'description': 'เครื่องเกมมิ่งสเปคแรง พร้อมใช้งาน ทำความสะอาดและ Burn-in แล้ว',
                'rating': 4.8,
                'total_reviews': 12,
            },
            {
                'title': 'Compact Mini-ITX Office PC',
                'price': 15900,
                'category': PRODUCT_CATEGORIES[1],
                'condition': PRODUCT_CONDITIONS[2],
                'location': DEFAULT_LOCATIONS[0],
                'warranty': 'ร้าน 3 เดือน',
                'seller_id': users[0].id,
                'specs': ['Intel i5-12400', '16GB RAM', 'SSD 512GB', 'เคสเล็ก'],
                'description': 'เครื่องเล็กกะทัดรัด เหมาะกับงานออฟฟิศ ทำงานเอกสาร ประหยัดพื้นที่',
                'rating': 4.5,
                'total_reviews': 4,
            },

            # ── Processors ──
            {
                'title': 'AMD Ryzen 9 7950X CPU',
                'price': 16900,
                'category': PRODUCT_CATEGORIES[2],
                'condition': PRODUCT_CONDITIONS[1],
                'location': DEFAULT_LOCATIONS[0],
                'warranty': 'เหลือ 12 เดือน',
                'seller_id': users[1].id,
                'specs': ['16 คอร์ / 32 เธรด', 'ซ็อกเก็ต AM5', 'ไม่เคย OC'],
                'description': 'ซีพียูแรงสำหรับตัดต่อวิดีโอ เรนเดอร์ และงานหนักหลายโปรแกรมพร้อมกัน',
                'rating': 4.9,
                'total_reviews': 7,
            },
            {
                'title': 'Intel Core i5-13600K',
                'price': 9900,
                'category': PRODUCT_CATEGORIES[2],
                'condition': PRODUCT_CONDITIONS[1],
                'location': DEFAULT_LOCATIONS[2],
                'warranty': 'เหลือ 14 เดือน',
                'seller_id': users[0].id,
                'specs': ['14 คอร์ (6P+8E)', 'ซ็อกเก็ต LGA1700', 'ไม่เคย OC'],
                'description': 'ซีพียูเล่นเกมคุ้มค่า ใช้ในเครื่องสำรอง เปลี่ยนเป็นรุ่นใหม่จึงปล่อย',
                'rating': 4.8,
                'total_reviews': 5,
            },

            # ── Peripherals (keyboard/mouse/audio) ──
            {
                'title': 'Keychron Q1 Max พร้อม Keycap GMK',
                'price': 8900,
                'category': PRODUCT_CATEGORIES[3],
                'condition': PRODUCT_CONDITIONS[1],
                'location': DEFAULT_LOCATIONS[0],
                'warranty': 'เหลือ 11 เดือน',
                'seller_id': users[1].id,
                'specs': ['Switch Silent Tactile', 'Foam Mod ครบ', 'แถมสายถัก'],
                'description': 'คีย์บอร์ดประกอบเอง โทนเสียงนุ่ม เงียบ พร้อมดอง 3 โปรไฟล์',
                'rating': 4.95,
                'total_reviews': 15,
            },
            {
                'title': 'Logitech G Pro X Superlight',
                'price': 3200,
                'category': PRODUCT_CATEGORIES[3],
                'condition': PRODUCT_CONDITIONS[2],
                'location': DEFAULT_LOCATIONS[1],
                'warranty': 'none',
                'seller_id': users[0].id,
                'specs': ['น้ำหนัก 63g', 'ไร้สาย', 'เซ็นเซอร์ HERO 25K'],
                'description': 'เมาส์เกมมิ่งเบามาก ไร้สาย เหมาะกับเกม FPS ที่ต้องการความแม่นยำ',
                'rating': 4.7,
                'total_reviews': 10,
            },
            {
                'title': 'Corsair Virtuoso Wireless SE',
                'price': 5900,
                'category': PRODUCT_CATEGORIES[3],
                'condition': PRODUCT_CONDITIONS[2],
                'location': DEFAULT_LOCATIONS[4],
                'warranty': 'ร้าน 6 เดือน',
                'seller_id': users[1].id,
                'specs': ['7.1 Surround', 'แบต 18 ชม.', 'พร้อมเคส'],
                'description': 'หูฟังไร้สายใช้งานในสตูดิโอ เสียงคมชัด ไมค์ดี เหมาะกับสตรีมเมอร์',
                'rating': 4.6,
                'total_reviews': 9,
            },

            # ── Monitors ──
            {
                'title': 'Sony INZONE M9 4K 144Hz',
                'price': 22900,
                'category': PRODUCT_CATEGORIES[4],
                'condition': PRODUCT_CONDITIONS[2],
                'location': DEFAULT_LOCATIONS[2],
                'warranty': 'ถึง พ.ย. 2025',
                'seller_id': users[0].id,
                'specs': ['27 นิ้ว 4K HDR', 'USB-C', 'Local Dimming'],
                'description': 'จอเล่นเกม 4K ภาพคมชัด ไม่ติด Dead pixel มีขาตั้งครบ',
                'rating': 4.7,
                'total_reviews': 5,
            },
            {
                'title': "LG UltraGear 34'' QHD 160Hz",
                'price': 24900,
                'category': PRODUCT_CATEGORIES[4],
                'condition': PRODUCT_CONDITIONS[2],
                'location': DEFAULT_LOCATIONS[2],
                'warranty': 'ถึง ก.ย. 2025',
                'seller_id': users[0].id,
                'specs': ['Nano IPS', 'HDR600', 'Curve 800R', 'จอโค้ง'],
                'description': 'จอโค้งกว้างพิเศษ ภาพลื่น เหมาะกับเกมและทำงานหลายหน้าต่าง',
                'rating': 4.7,
                'total_reviews': 6,
            },
            {
                'title': 'Dell 24" IPS 75Hz Office Monitor',
                'price': 3500,
                'category': PRODUCT_CATEGORIES[4],
                'condition': PRODUCT_CONDITIONS[2],
                'location': DEFAULT_LOCATIONS[3],
                'warranty': 'none',
                'seller_id': users[1].id,
                'specs': ['1080p', 'IPS', 'ปรับระดับได้'],
                'description': 'จอทำงานทั่วไป สบายตา เหมาะกับงานเอกสารและประชุมออนไลน์',
                'rating': 4.4,
                'total_reviews': 8,
            },

            # ── Storage ──
            {
                'title': 'Samsung 980 Pro 2TB + Heatsink',
                'price': 6800,
                'category': PRODUCT_CATEGORIES[5],
                'condition': PRODUCT_CONDITIONS[0],
                'location': DEFAULT_LOCATIONS[3],
                'warranty': 'ศูนย์ 5 ปี',
                'seller_id': users[0].id,
                'specs': ['อ่าน 7,000MB/s', 'PCIe 4.0', 'รองรับ PS5'],
                'description': 'SSD ความเร็วสูง ยังไม่ลงทะเบียน เหมาะกับเครื่องเกมหรือ PS5 ส่ง EMS ฟรี',
                'rating': 4.85,
                'total_reviews': 7,
            },
            {
                'title': 'WD Black SN770 1TB NVMe',
                'price': 2400,
                'category': PRODUCT_CATEGORIES[5],
                'condition': PRODUCT_CONDITIONS[1],
                'location': DEFAULT_LOCATIONS[0],
                'warranty': 'ศูนย์ 4 ปี',
                'seller_id': users[1].id,
                'specs': ['อ่าน 5,150MB/s', 'PCIe 4.0', '1TB'],
                'description': 'SSD ราคาประหยัด บูตเครื่องและโหลดเกมเร็ว เหมาะเป็นไดรฟ์เสริม',
                'rating': 4.7,
                'total_reviews': 12,
            },
        ]

        for product_data in products_data:
            product = Product(**product_data, status='available')
            db.session.add(product)

        db.session.commit()
        print(f"✅ สร้างสินค้า {len(products_data)} รายการ")

        print("\n" + "="*50)
        print("✨ ข้อมูล demo สร้างสมบูรณ์!")
        print("="*50)
        print("\n📧 ผู้ใช้ทดลอง:")
        for user_data in users_data:
            print(f"  Email: {user_data['email']}")
            print(f"  Password: {user_data['password']}")
            print(f"  Type: {user_data['user_type']}\n")

if __name__ == '__main__':
    seed_app()
