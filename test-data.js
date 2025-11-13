// Datos de prueba para Quini 6 y Loto Plus
// Este archivo contiene 10 sorteos de ejemplo para testing

const sorteosPruebaQuini6 = [
    {
        concursoId: 4300,
        fecha: '2025-10-23', // Miércoles
        primerSorteo: [3, 12, 18, 26, 33, 44],
        segundaDelQuini: [5, 11, 19, 24, 37, 43],
        revancha: [2, 8, 16, 21, 27, 35],
        siempreSale: [1, 7, 14, 22, 29, 41]
    },
    {
        concursoId: 4301,
        fecha: '2025-10-26', // Domingo
        primerSorteo: [4, 13, 20, 28, 34, 45],
        segundaDelQuini: [6, 10, 17, 25, 38, 42],
        revancha: [1, 9, 15, 23, 30, 36],
        siempreSale: [2, 8, 14, 21, 31, 40]
    },
    {
        concursoId: 4302,
        fecha: '2025-10-30', // Miércoles
        primerSorteo: [7, 14, 22, 29, 36, 43],
        segundaDelQuini: [3, 12, 18, 26, 33, 41],
        revancha: [5, 11, 19, 24, 31, 38],
        siempreSale: [1, 8, 15, 23, 30, 45]
    },
    {
        concursoId: 4303,
        fecha: '2025-11-02', // Domingo
        primerSorteo: [2, 9, 16, 25, 32, 39],
        segundaDelQuini: [4, 13, 20, 27, 35, 44],
        revancha: [6, 12, 17, 24, 31, 42],
        siempreSale: [3, 10, 18, 26, 33, 40]
    },
    {
        concursoId: 4304,
        fecha: '2025-11-06', // Miércoles
        primerSorteo: [1, 8, 15, 23, 30, 37],
        segundaDelQuini: [5, 11, 19, 26, 34, 41],
        revancha: [7, 14, 21, 28, 36, 43],
        siempreSale: [2, 9, 16, 24, 32, 45]
    },
    {
        concursoId: 4305,
        fecha: '2025-11-09', // Domingo
        primerSorteo: [6, 13, 20, 27, 35, 42],
        segundaDelQuini: [3, 10, 17, 25, 32, 39],
        revancha: [1, 8, 15, 22, 29, 44],
        siempreSale: [4, 11, 18, 26, 33, 40]
    },
    {
        concursoId: 4306,
        fecha: '2025-11-13', // Miércoles
        primerSorteo: [5, 12, 19, 26, 34, 41],
        segundaDelQuini: [7, 14, 21, 28, 36, 43],
        revancha: [2, 9, 16, 23, 31, 38],
        siempreSale: [1, 10, 17, 24, 32, 45]
    },
    {
        concursoId: 4307,
        fecha: '2025-11-16', // Domingo
        primerSorteo: [4, 11, 18, 25, 33, 40],
        segundaDelQuini: [6, 13, 20, 27, 35, 42],
        revancha: [3, 8, 15, 22, 30, 37],
        siempreSale: [5, 12, 19, 26, 34, 44]
    },
    {
        concursoId: 4308,
        fecha: '2025-11-20', // Miércoles
        primerSorteo: [7, 15, 22, 29, 37, 44],
        segundaDelQuini: [2, 9, 16, 24, 31, 38],
        revancha: [4, 11, 18, 26, 33, 41],
        siempreSale: [1, 8, 17, 25, 32, 45]
    },
    {
        concursoId: 4309,
        fecha: '2025-11-23', // Domingo
        primerSorteo: [3, 10, 17, 24, 32, 39],
        segundaDelQuini: [5, 12, 19, 27, 34, 42],
        revancha: [6, 13, 21, 28, 36, 43],
        siempreSale: [2, 9, 16, 23, 30, 40]
    }
];

const sorteosPruebaLotoPlus = [
    {
        concursoID_LotoPlus: 4100,
        fechaSorteo: '2025-10-23', // Miércoles
        tradicional: ['03','12','18','26','33','44'],
        match: ['05','11','19','24','37','43'],
        desquite: ['02','08','16','21','27','35'],
        saleOSale: ['01','07','14','22','29','41'],
        numeroJack: 5
    },
    {
        concursoID_LotoPlus: 4101,
        fechaSorteo: '2025-10-26', // Domingo
        tradicional: ['04','13','20','28','34','45'],
        match: ['06','10','17','25','38','42'],
        desquite: ['01','09','15','23','30','36'],
        saleOSale: ['02','08','14','21','31','40'],
        numeroJack: 8
    },
    {
        concursoID_LotoPlus: 4102,
        fechaSorteo: '2025-10-30', // Miércoles
        tradicional: ['07','14','22','29','36','43'],
        match: ['03','12','18','26','33','41'],
        desquite: ['05','11','19','24','31','38'],
        saleOSale: ['01','08','15','23','30','45'],
        numeroJack: 1
    },
    {
        concursoID_LotoPlus: 4103,
        fechaSorteo: '2025-11-02', // Domingo
        tradicional: ['02','09','16','25','32','39'],
        match: ['04','13','20','27','35','44'],
        desquite: ['06','12','17','24','31','42'],
        saleOSale: ['03','10','18','26','33','40'],
        numeroJack: 9
    },
    {
        concursoID_LotoPlus: 4104,
        fechaSorteo: '2025-11-06', // Miércoles
        tradicional: ['01','08','15','23','30','37'],
        match: ['05','11','19','26','34','41'],
        desquite: ['07','14','21','28','36','43'],
        saleOSale: ['02','09','16','24','32','45'],
        numeroJack: 0
    }
];

module.exports = {
    sorteosPruebaQuini6,
    sorteosPruebaLotoPlus
};