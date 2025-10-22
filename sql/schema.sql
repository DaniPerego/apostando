CREATE TABLE quini6_sorteos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    concurso_id INT NOT NULL UNIQUE,
    fecha_sorteo DATE NOT NULL,
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE quini6_modalidades (
    id INT AUTO_INCREMENT PRIMARY KEY,
    sorteo_id INT NOT NULL,
    modalidad ENUM('primerSorteo','segundaDelQuini','revancha','siempreSale') NOT NULL,
    posicion TINYINT UNSIGNED NOT NULL CHECK (posicion BETWEEN 1 AND 6),
    numero TINYINT UNSIGNED NOT NULL CHECK (numero BETWEEN 0 AND 45),
    UNIQUE KEY uq_quini6_modalidad (sorteo_id, modalidad, posicion),
    CONSTRAINT fk_quini6_modalidades_sorteo FOREIGN KEY (sorteo_id)
        REFERENCES quini6_sorteos (id)
        ON DELETE CASCADE
);

CREATE TABLE quini6_premio_extra (
    sorteo_id INT NOT NULL,
    posicion TINYINT UNSIGNED NOT NULL CHECK (posicion BETWEEN 1 AND 18),
    numero TINYINT UNSIGNED NOT NULL CHECK (numero BETWEEN 0 AND 45),
    PRIMARY KEY (sorteo_id, posicion),
    CONSTRAINT fk_quini6_premio_extra_sorteo FOREIGN KEY (sorteo_id)
        REFERENCES quini6_sorteos (id)
        ON DELETE CASCADE
);

CREATE TABLE brinco_sorteos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    concurso_id INT NOT NULL UNIQUE,
    fecha_sorteo DATE NOT NULL,
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE brinco_modalidades (
    id INT AUTO_INCREMENT PRIMARY KEY,
    sorteo_id INT NOT NULL,
    modalidad ENUM('brincoTradicional','brincoJunior') NOT NULL,
    posicion TINYINT UNSIGNED NOT NULL CHECK (posicion BETWEEN 1 AND 6),
    numero TINYINT UNSIGNED NOT NULL CHECK (numero BETWEEN 0 AND 39),
    UNIQUE KEY uq_brinco_modalidad (sorteo_id, modalidad, posicion),
    CONSTRAINT fk_brinco_modalidades_sorteo FOREIGN KEY (sorteo_id)
        REFERENCES brinco_sorteos (id)
        ON DELETE CASCADE
);

CREATE INDEX idx_quini6_numero ON quini6_modalidades (numero);
CREATE INDEX idx_brinco_numero ON brinco_modalidades (numero);