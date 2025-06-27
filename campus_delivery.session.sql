CREATE TABLE reviews (
  id INT AUTO_INCREMENT PRIMARY KEY,
  product_id INT NOT NULL,
  user_name VARCHAR(100) NOT NULL,
  rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);
INSERT INTO reviews (product_id, user_name, rating, comment)
VALUES 
  (1, 'Alice', 5, 'Super fresh apples!'),
  (1, 'Bob', 4, 'Crisp and juicy.'),
  (2, 'Carol', 3, 'Okay for baby shampoo, not the best scent.');
