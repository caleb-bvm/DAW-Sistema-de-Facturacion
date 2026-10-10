# IVA incluido y comisiones del vendedor
Decisión confirmada por el usuario el 10 de octubre de 2026.

El precio del producto incluye el IVA aplicable. Por línea se multiplica el precio por la cantidad, se resta el descuento y, para productos gravados, se divide el importe final entre 1.13. El IVA es la diferencia entre el importe final y la base redondeada. No se resta el 13 % directamente del precio.

La comisión se calcula sobre la base sin IVA de cada línea. Se conserva la escala existente de la aplicación:

| Base por línea sin IVA | Comisión |
| ---: | ---: |
| $0.00 | 0 % |
| Hasta $100.00 | 1 % |
| $100.01 a $1,000.00 | 2 % |
| $1,000.01 a $2,000.00 | 3 % |
| Desde $2,000.01 | 4 % |

La comisión de la factura es la suma de las comisiones de sus líneas. Dos unidades a $113.00 tienen total $226.00, base $200.00, IVA $26.00 y comisión $4.00 (2 %).

Para productos exentos y no sujetos no se extrae IVA; su importe final es la base de comisión y se conserva su clasificación. Todos los cálculos usan centavos enteros con redondeo por línea antes de sumar. El servidor valida los importes con los precios del catálogo y guarda base, IVA, porcentaje y comisión de cada línea.

Esta decisión reemplaza el cálculo anterior que añadía el IVA al final.
