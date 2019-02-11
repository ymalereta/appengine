const express = require('express');

const fileUpload = require('express-fileupload');

const app = express();

const PORT = 8000;

app.use(express.static('public'));

app.use(fileUpload());

app.post('/upload', (req, res) => 
{
    if (Object.keys(req.files).length == 0) 
    {
        return res.status(400).send('No files were uploaded.');
    }
    
    let fileContent = req.files.txtFile.data.toString();

    let csvData = convertTxtToCsv(fileContent);

    let oldFileName = req.files.txtFile.name;

    sendBackToClient(res, csvData, oldFileName);
})


var server = app.listen(process.env.PORT || PORT,() =>
{
    console.log('App listening on port %s', server.address().port);
})

convertTxtToCsv = fileContent => 
{
    let lines = fileContent.split(/\r\n/);

    let resultRows = [];

    let loanNum = '';

    lines.forEach(line => 
    {
        const regLoanNumLine = /^\s*(\d[\d\s]{13}).{9}(\d\d-\d\d)(.{13}\.\d\d)\s{4}(\d\d)/;
        const reglienLine = /^\s{24}(\d{3})\s{6}(\d\d)\s{3}(\d{5}[\d\s]{7})/;
        const regPaymentInfo = /^\s{24}(\d\d-\d\d)(.{13}\.\d\d)\s{4}(\d\d)/;
        const regParcelInfo = /^.{43}(\d\d)\s\s(\d{5}[\d\s]{7})\s{9}(.{30})/;

        let loanNumLine = regLoanNumLine.exec(line);

        if (isValidArray(loanNumLine)) 
        {
            loanNum = loanNumLine[1].trim();
            let dueDate = loanNumLine[2].trim();
            let amount = loanNumLine[3].trim();
            let term = loanNumLine[4].trim();

            resultRows.push(creatNewRow(loanNum, dueDate, amount, term));
        }

        let lienLine = reglienLine.exec(line);

        if (isValidArray(lienLine)) 
        {
            let lienRow = resultRows.pop();
            lienRow[colTaxType] = lienLine[1].trim();
            lienRow[colSeqNum] = lienLine[2].trim();
            lienRow[colConvertPayee] = lienLine[3].trim();
            resultRows.push(lienRow);
        }

        let paymentLine = regPaymentInfo.exec(line);

        if (isValidArray(paymentLine)) 
        {
            let dueDate = paymentLine[1].trim();
            let amount = paymentLine[2].trim();
            let term = paymentLine[3].trim();

            resultRows.push(creatNewRow(loanNum, dueDate, amount, term));
        }

        let parcelLine = regParcelInfo.exec(line);

        if (isValidArray(parcelLine)) 
        {
            let parcelSeq = parcelLine[1].trim();
            let parcelPayee = parcelLine[2].trim();
            let parcelNumber = parcelLine[3].trim();

            let indexes = getMatchedRowIndexes(resultRows, loanNum, parcelSeq, parcelPayee);

            indexes.forEach(index => 
            {
                resultRows[index][colParcelNum] = parcelNumber;
            });
        }
    });

    let output = 'CONVERT_ID, OLD_LOAN_NUMBER, CONVERT_PAYEE, PAYEE_PARCEL_NUMBER, DUE_DATE, AMOUNT, TAX_TYPE, SEQUENCE_NUMBER, TERM\r\n';

    resultRows.forEach(row => 
    {
        //row is invalid if no parcel number
        if(row[colParcelNum])
        {
            output = output + Object.keys(row).map(k => row[k]).join(",") + '\r\n';  
        }     
    });

    return output;
}

const colConvertId = 'convertId';
const colLoanNum = 'loanNumber';
const colDueDate = 'dueDate';
const colAmount = 'amount';
const colTerm = 'term';
const colTaxType = 'taxType';
const colSeqNum = 'sequenceNumber';
const colConvertPayee = 'convertPayee';
const colParcelNum = 'parcelNumber';

creatNewRow = (loanNum, dueDate, amount, term) => 
{
    let row = {};
    row[colConvertId] = new Date().toISOString().slice(0, 10).replace(/-/g, '') + '_P10P';  //e.g. 20190201_P10P
    row[colLoanNum] = loanNum;
    row[colConvertPayee] = '';
    row[colParcelNum] = '';
    row[colDueDate] = dueDate.replace('-', '/1/20');;
    row[colAmount] = amount.trim().replace(/,/g, '');
    row[colTaxType] = '';
    row[colSeqNum] = '';
    row[colTerm] = term;

    return row;
}

sendBackToClient = (res, csvData, oldFileName) => 
{
    let newFileName = oldFileName.substr(0, oldFileName.lastIndexOf(".")) + ".csv";

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', 'inline; filename=' + newFileName);
    res.send(csvData);
}

getMatchedRowIndexes = (rows, currLoanNum, parcelSeq, parcelPayee) => 
{
    const searchRange = 10;

    const seqRange20 = 20;

    let indexes = [];

    for (i = Math.max(0, rows.length - searchRange); i < rows.length; i++) 
    {
        if (rows[i][colLoanNum].trim() != currLoanNum.trim())
            continue;

        if (parcelSeq + 0 > seqRange20) 
        {
            if (rows[i][colConvertPayee].trim() == parcelPayee.trim())
                indexes.push(i);
        }
        else 
        {
            if (rows[i][colSeqNum] + 0 == parcelSeq + 0 && rows[i][colConvertPayee].trim() == parcelPayee.trim())
                indexes.push(i);
        }
    }
    return indexes;
}

isValidArray = (input) => Array.isArray(input) && input.length > 0;







