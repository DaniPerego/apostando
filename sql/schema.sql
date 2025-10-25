CREATE TABLE IF NOT EXISTS quini_sorteos (
  id INT PRIMARY KEY,
  fecha DATE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS quini_numeros (
  sorteo_id INT,
  tipo ENUM('primer','segunda','revancha','siempre','premio_extra'),
  numero TINYINT,
  PRIMARY KEY (sorteo_id, tipo, numero)
);

CREATE TABLE IF NOT EXISTS brinco_sorteos (
  id INT PRIMARY KEY,
  fecha DATE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS brinco_numeros (
  sorteo_id INT,
  tipo ENUM('tradicional','junior'),
  numero TINYINT,
  PRIMARY KEY (sorteo_id, tipo, numero)
);