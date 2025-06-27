-- 🔥 DROP OLD TABLES
DROP TABLE IF EXISTS product_images;
DROP TABLE IF EXISTS products;
DROP TABLE IF EXISTS categories;
DROP TABLE IF EXISTS sellers;

-- 👤 Sellers
CREATE TABLE sellers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100),
  rating FLOAT DEFAULT 0,
  follower_count INT DEFAULT 0,
  is_verified BOOLEAN DEFAULT false
);

INSERT INTO sellers (name, rating, follower_count, is_verified) VALUES
('Campus Mart', 4.5, 1000, true),
('Student Essentials', 4.0, 500, false),
('Fresh Basket', 4.8, 800, true);

-- 🏷️ Categories (from your FilterSidebar)
CREATE TABLE categories (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL
);

INSERT INTO categories (name) VALUES
('Foods and drinks'),
('Beauty and Cosmetics'),
('Baby Products'),
('Electronics'),
('Stationery'),
('Fresh Vegetables'),
('Fresh Fruits'),
('Cereals and Grains'),
('Traditional Vegetables'),
('Dairy and Poultry'),
('Beauty and Personal Care'),
('Home Services'),
('Repair Services'),
('Construction and Housing'),
('Transport Services');

-- 📦 Products
CREATE TABLE products (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100),
  description TEXT,
  long_description TEXT,
  price DECIMAL(10,2),
  old_price DECIMAL(10,2),
  category_id INT,
  seller_id INT,
  rating FLOAT DEFAULT 0,
  review_count INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (category_id) REFERENCES categories(id),
  FOREIGN KEY (seller_id) REFERENCES sellers(id)
);

INSERT INTO products (name, description, long_description, price, old_price, category_id, seller_id, rating, review_count)
VALUES
('Organic Apples', 'Fresh juicy apples', 'Grown locally and delivered same day.', 300.00, 350.00, 7, 3, 4.8, 12),
('Baby Shampoo', 'Gentle on skin', 'Natural ingredients with no tears formula.', 800.00, 900.00, 3, 2, 4.3, 24),
('Chicken Pack', 'Farm fresh chicken', 'Locally sourced poultry, well packed.', 1200.00, 1300.00, 10, 3, 4.7, 32),
('HP Inkjet Printer', 'Color printer for school projects', 'Compact, fast, and reliable.', 8500.00, 9200.00, 4, 1, 4.5, 18);

-- 🖼️ Product Images
CREATE TABLE product_images (
  id INT AUTO_INCREMENT PRIMARY KEY,
  product_id INT,
  url TEXT,
  FOREIGN KEY (product_id) REFERENCES products(id)
);

INSERT INTO product_images (product_id, url) VALUES
(1, 'http://localhost:5000/uploads/apples.jpg'),
(2, 'http://localhost:5000/uploads/shampoo.jpg'),
(3, 'http://localhost:5000/uploads/chicken.jpg'),
(4, 'http://localhost:5000/uploads/printer.jpg');
