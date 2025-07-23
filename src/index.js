import { program } from 'commander'
import { readFile } from 'fs/promises'
import { join } from 'path'

program
    .option('--num-abonado <numAbonado>', 'number of abonado')
    .option('--max-consumo <maxConsumo>', 'minimum consumption', 0)
    .option('--num-trimestres <numTrimestres>', 'number of trimesters', 10)

program.parse()

const options = program.opts()

const fileDump = 'resources/T_SIA_LECTURAS_v2.csv'
const fileNew = 'resources/Lecturas_Aranda.csv'
const numAbonado = options.numAbonado
const maxConsumo = options.maxConsumo
const numTrimestres = options.numTrimestres

const readCSVFile = async (params) => {
    // Read file
    const filePath = join(import.meta.dirname, '..', params.file)
    console.log(`Reading file: ${filePath}`)
    const fileContent = await readFile(filePath, 'utf8')
    return fileContent
}

/**
 *    this is the lecture object
 * { CABONADO: '40317',
      CPERIODO: '2',
      CANO_LECT: '2008',
      FLECTURA: '16/06/08',
      CTIPOFACT: 'T',
      NLECTURA: '2128',
      NCONSUMO: '0',
      NIMPUTADO: '0',
      SFACTURADO: '-1',
      NLECTFACT: '0',
      CORIGENLECT: '1',
      COPERARIO: '1',
      CCONTADOR: 'J837169',
      CCODUSU: 'IBER',
      FULMOD: '200807090849',
      SBASE: '0',
      NSEQ: '1',
      CHORA: '00001216',
      NCERTIFICA: '',
      SMINIMO: '0',
      SPROMEDIO: '0',
      SREAL: '0',
      NCONS_REAL: '0',
      DOBSERV: '\r'
 */

// Function to parse the date
const parseDate = (dateString) => {
    const [day, month, year] = dateString.split('/')
    return new Date(parseInt(year) + 2000, parseInt(month) - 1, day)
}

// Function to mangle the object
const mangleLecturaObj = (obj) => {
    obj['ano_trimestre'] = `${obj.CANO_LECT}T${obj.CPERIODO}`
    obj['fecha_lectura'] = parseDate(obj.FLECTURA || '01/01/2000')
    return obj;
}

const parseCSVOld = (fileContent) => {
    const lines = fileContent.split('\n')
    const headers = lines[0].split(',').map(header => header.trim().replace(/\r/g, ''))
    const data = lines.slice(1).map(line => {
        const values = line.split(',')
        const obj = headers.reduce((obj, header, index) => {
            obj[header] = (values[index] || '').trim().replace(/\r/g, '')
            return obj
        }, {});
        return mangleLecturaObj(obj);
    })
    return data.filter(item => item !== null)
        .map(item => {
            // Convert the numeric values to numbers
            item.CPERIODO = parseInt(item.CPERIODO)
            item.CANO_LECT = parseInt(item.CANO_LECT)
            item.NLECTURA = parseInt(item.NLECTURA)
            item.NCONSUMO = parseInt(item.NCONSUMO)
            item.NIMPUTADO = parseInt(item.NIMPUTADO)
            item.SFACTURADO = parseInt(item.SFACTURADO)
            item.NLECTFACT = parseInt(item.NLECTFACT)
            item.SMINIMO = parseFloat(item.SMINIMO)
            item.SPROMEDIO = parseFloat(item.SPROMEDIO)
            item.SREAL = parseFloat(item.SREAL)
            return item
        })
}

const parseCSVNew = (fileContent) => {
    const lines = fileContent.split('\n')
    const ret = [];
    lines.slice(1).forEach(line => {
        const values = line.split(';')
        if (isNaN(values[0])) {
            return null
        }
        const CABONADO = values[0].trim().replace(/\r/g, '')
        const t124 = {
            CABONADO,
            ano_trimestre: '2024T1',
            NLECTURA: parseInt(values[1].trim().replace(/\r/g, '')),
            fecha_lectura: new Date(`2024-01-01`),
            CANO_LECT: 2024,
            CPERIODO: 1,
        };
        const t224 = {
            CABONADO,
            ano_trimestre: '2024T2',
            NLECTURA: parseInt(values[2].trim().replace(/\r/g, '')),
            fecha_lectura: new Date(`2024-04-01`),
            CANO_LECT: 2024,
            CPERIODO: 2,
        };
        const t324 = {
            CABONADO,
            ano_trimestre: '2024T3',
            NLECTURA: parseInt(values[3].trim().replace(/\r/g, '')),
            fecha_lectura: new Date(`2024-07-01`),
            CANO_LECT: 2024,
            CPERIODO: 3,
        };
        const t424 = {
            CABONADO,
            ano_trimestre: '2024T4',
            NLECTURA: parseInt(values[4].trim().replace(/\r/g, '')),
            fecha_lectura: new Date(`2024-10-01`),
            CANO_LECT: 2024,
            CPERIODO: 4,
        };
        const t125 = {
            CABONADO,
            ano_trimestre: '2025T1',
            NLECTURA: parseInt(values[5].trim().replace(/\r/g, '')),
            fecha_lectura: new Date(`2025-01-01`),
            CANO_LECT: 2025,
            CPERIODO: 1,
        };
        ret.push(t124, t224, t324, t424, t125);
    })
    return ret;
}

// Function to reduce the data by CABONADO
const reduceByCAbonado = (accumulator, currentValue) => {
    const key = currentValue.CABONADO
    if (!accumulator[key]) {
        accumulator[key] = []
    }
    accumulator[key].push(currentValue)
    return accumulator
}

const sortByTrimestreLectura = (a, b) => {
    return new Date(a.fecha_lectura) - new Date(b.fecha_lectura)
}

const getAllAbonadosWithAtLeastOneLecturaBiggerThan = (lecturas, threshold) => {
    const abonadosSet = new Set();
    lecturas.forEach(lectura => {
        if (parseInt(lectura.NCONSUMO) > threshold) {
            abonadosSet.add(lectura.CABONADO);
        }
    });
    return Array.from(abonadosSet);
}

const getAllAbonadosWithXConsumeZeroInTheLastYTrimestres = (groupedAbonado, maxConsumo, numTrimestres) => {
    const abonadosSet = new Set();
    Object.values(groupedAbonado).forEach(abonado => {
        const lecturas = abonado.sort(sortByTrimestreLectura);

        if (lecturas.length === 0) {
            // If there are not enough readings, skip this abonado
            return;
        }
        // Check that we have a lectura for this year
        if (!lecturas.some(lectura => lectura.CANO_LECT === 2025)) {
            return;
        }

        // Slice the last numTrimestres readings, excluding the first one
        const lecturasFilteredSliced = lecturas.slice(1).slice(-numTrimestres)
        const oldestLectura = lecturasFilteredSliced[0];
        const newestLectura = lecturasFilteredSliced[lecturasFilteredSliced.length - 1];
        // console.log(`Oldest lectura: ${oldestLectura.NLECTURA} (trimestre ${oldestLectura.ano_trimestre}), Newest lectura: ${newestLectura.NLECTURA} (trimestre ${newestLectura.ano_trimestre}), Abonado: ${oldestLectura.CABONADO}`);
        const diff = newestLectura.NLECTURA - oldestLectura.NLECTURA;
        // Filter out abonados with no readings (or 0)
        if (newestLectura.NLECTURA === 0 && oldestLectura.NLECTURA === 0) {
            return;
        }
        if (diff < 1 && diff > -1) {
            abonadosSet.add(lecturasFilteredSliced[0].CABONADO);
        }
    });
    return Array.from(abonadosSet);
}

const printConsumosMinimos = (groupedAbonado, maxConsumo, numTrimestres) => {
    // // const noConsumoInTheLastXLecturas = getAllAbonadosWithAtXLecturasThatAreZero(parsedData, numLecturas)
    const abonadosConsumoMinimo = getAllAbonadosWithXConsumeZeroInTheLastYTrimestres(groupedAbonado, maxConsumo, numTrimestres)
    // // console.log(abonadosConConsumoCeroEnLosUltimosXTrimestres.slice(abonadosConConsumoCeroEnLosUltimosXTrimestres.length - 10))
    // // console.log(JSON.stringify(abonadosConConsumoCeroEnLosUltimosXTrimestres, null, 2))
    for (const abonado of abonadosConsumoMinimo) {
        console.table(groupedAbonado[abonado].sort(sortByTrimestreLectura).splice(-numTrimestres))
        console.log('\n\n')
    }
    console.log(`There are ${abonadosConsumoMinimo.length} abonados with maxConsumo=${maxConsumo} in the last ${numTrimestres} trimesters`)
}

const printOnlyOneAbonado = (groupedData, numAbonado) => {
    const toPrint = groupedData[numAbonado].sort(sortByTrimestreLectura).map(item => {
        return {
            "Abonado": item.CABONADO,
            "CodContador": item.CCONTADOR,
            "Trimestre": item.ano_trimestre,
            "Fecha Lectura": item.fecha_lectura.toLocaleDateString(),
            "Consumo": item.NLECTURA,
            "Observaciones": item.DOBSERV,
        }
    });
    console.table(toPrint);
}


// Main function
const main = async () => {
    const fileDumpContent = await readCSVFile({ file: fileDump })
    const fileNewContent = await readCSVFile({ file: fileNew })
    const parsedDumpData = parseCSVOld(fileDumpContent)
    const parsedDataNew = parseCSVNew(fileNewContent)
    // Merge the two arrays
    parsedDumpData.push(...parsedDataNew)
    const groupedData = parsedDumpData.reduce(reduceByCAbonado, {})

    if (numAbonado) {
        printOnlyOneAbonado(groupedData, numAbonado);
    } else {
        printConsumosMinimos(groupedData, maxConsumo, numTrimestres);
    }
}

(async () => {
    try {
        await main()
    } catch (error) {
        console.error('Error:', error)
        process.exit(1)
    }
})()
