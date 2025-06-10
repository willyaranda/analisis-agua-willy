import { program } from 'commander'
import { readFile } from 'fs/promises'
import { join } from 'path'

program
    .option('--file <file>', 'input file')
    .option('--num-abonado <numAbonado>', 'number of abonado')
    .option('--max-consumo <maxConsumo>', 'minimum consumption', 0)
    .option('--num-trimestres <numTrimestres>', 'number of trimesters', 10)

program.parse()

const options = program.opts()

const file = options.file
const numAbonado = options.numAbonado
const maxConsumo = options.maxConsumo
const numTrimestres = options.numTrimestres

const readCSVFile = async (params) => {
    // Read file
    const filePath = join(import.meta.dirname, '..', params.file)
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

// Function to parse the file, as it's a csv
const parseCSV = (fileContent) => {
    const lines = fileContent.split('\n')
    const headers = lines[0].split(',').map(header => header.trim().replace(/\r/g, ''))
    const data = lines.slice(1).map(line => {
        const values = line.split(',')
        // Drop if the first value is not a number
        if (isNaN(values[0])) {
            return null
        }
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

        // First check if the fecha_lectura is in the last 5 years
        const lastDate = new Date();
        lastDate.setFullYear(lastDate.getFullYear() - 5);

        const lecturasFiltered = lecturas.filter(lectura => {
            return lectura.fecha_lectura >= lastDate
        });
        if (lecturasFiltered.length === 0 || lecturasFiltered.length < numTrimestres) {
            // If there are not enough readings, skip this abonado
            return;
        }
        // Get last numTrimestres
        // const lecturasLast = lecturasFiltered.slice(-numTrimestres);
        // // If the first and last are the same, then all are the same
        // if (lecturasLast[0].NLECTURA === lecturasLast[lecturasLast.length - 1].NLECTURA) {
        //     abonadosSet.add(lecturasLast[0].CABONADO);
        // }
        // If last lectura is 0, then do nothing
        if (lecturasFiltered[lecturasFiltered.length - 1].NLECTURA === 0) {
            return;
        }
        const diffConsumo = lecturas[lecturas.length - 1].NLECTURA - lecturas[Math.max(lecturas.length - numTrimestres, 0)].NLECTURA;
        if (diffConsumo <= maxConsumo) {
            abonadosSet.add(lecturas[0].CABONADO);
        }
    });
    return Array.from(abonadosSet);
}


// Main function
const main = async () => {
    if (!file) {
        console.error('Please provide a file path using --file option')
        process.exit(1)
    }
    const fileContent = await readCSVFile({ file })
    const parsedData = parseCSV(fileContent)
    const groupedData = parsedData.reduce(reduceByCAbonado, {})
    // const noConsumoInTheLastXLecturas = getAllAbonadosWithAtXLecturasThatAreZero(parsedData, numLecturas)
    const abonadosConsumoMinimo = getAllAbonadosWithXConsumeZeroInTheLastYTrimestres(groupedData, maxConsumo, numTrimestres)
    // console.log(abonadosConConsumoCeroEnLosUltimosXTrimestres.slice(abonadosConConsumoCeroEnLosUltimosXTrimestres.length - 10))
    // console.log(JSON.stringify(abonadosConConsumoCeroEnLosUltimosXTrimestres, null, 2))
    for (const abonado of abonadosConsumoMinimo) {
        console.table(groupedData[abonado].sort(sortByTrimestreLectura))
        console.log('\n\n')
    }
    console.log(`There are ${abonadosConsumoMinimo.length} abonados with maxConsumo=${maxConsumo} in the last ${numTrimestres} trimesters, and in the last 5 years`)

    // 80003311 casa abuela
    // console.table(groupedData[numAbonado].sort(sortByTrimestreLectura))
    // console.table(parsedData.slice(0, 1000).sort(sortByTrimestreLectura))

    // Do something with the parsed data
    // For example, save it to a database or process it further
    // ...
    // For now, we'll just log it to the console
    // Return the parsed data
    return parsedData
}

(async () => {
    try {
        await main()
    } catch (error) {
        console.error('Error:', error)
        process.exit(1)
    }
})()
