/*jslint indent: 2*/
/*global FileReader, DOMParser, Blob*/
'use strict';
const NEWLINE = '\n';
let CSV_SEPARATOR = ',';
const dropzone = document.getElementById('dropzone');
const progressOverlay = document.getElementById('progress-overlay');
const input = document.getElementById('input');
const section = document.getElementById('results');
const anchor = document.getElementById('results-anchor');
const table = document.getElementById('results-table');
const logDiv = document.getElementById('debuglog');
const logArea = document.getElementById('logtext');
const parser = new DOMParser();
const decoder = new TextDecoder("utf-8");

const STAGE_START = 0;
const STAGE_READING = 1;
const STAGE_AGGREGATING = 2;
const STAGE_GENERATING = 3;
const STAGE_FINISHED = 4;

function logError(message) {
    console.error(message);
    logArea.value += "[ERROR] " + message + '\n'
}

function logInfo(message) {
    console.info(message);
    logArea.value += "[INFO] " + message + '\n'
}

function logDebug(message) {
    console.debug(message);
}

function createElementFromHTML(htmlString) {
    var div = document.createElement('div');
    div.innerHTML = htmlString.trim();
    return div.firstChild;
}

document.getElementById('showdebug').addEventListener('click', function(e) {
    e.preventDefault();
    if (logDiv.style.display === 'none') {
        logDiv.style.display = 'block';
    } else {
        logDiv.style.display = 'none';
    }
}, false);


setProgress(0, 0);

function setProgress(stage, percent) {
    let percentage = percent;
    percentage *= 100;
    percentage = Math.round(percentage);

    if (stage === STAGE_READING) {
        progressOverlay.style.display = 'flex';
        progressOverlay.style.backgroundColor = 'var(--progress-background-color)';
        progressOverlay.textContent = 'Running in circles... (' + percentage + '%)';
        section.style.display = 'none';
    } else if (stage === STAGE_AGGREGATING) {
        progressOverlay.style.display = 'flex';
        progressOverlay.style.backgroundColor = 'var(--progress-background-color)';
        progressOverlay.textContent = 'Riding uphill... (' + percentage + '%)';
        section.style.display = 'none';
    } else if (stage === STAGE_GENERATING) {
        progressOverlay.style.display = 'flex';
        progressOverlay.style.backgroundColor = 'var(--progress-background-color)';
        progressOverlay.textContent = 'Lifting weights... (' + percentage + '%)';
        section.style.display = 'none';
    } else if (stage === STAGE_FINISHED) {
        progressOverlay.style.display = 'flex';
        progressOverlay.style.backgroundColor = 'var(--transparent)';
        progressOverlay.textContent = 'Exhausted, catching a breath! (100%)';
        section.style.display = "block";
    } else {
        progressOverlay.style.display = 'none';
        progressOverlay.style.backgroundColor = 'var(--progress-background-color)';
        progressOverlay.textContent = 'Ready to go! Please select your export.xml';
        section.style.display = 'none';
    }
}

function yieldingLoop(count, chunksize, callback, finished) {
    var i = 0;
    (function chunk() {
        var end = Math.min(i + chunksize, count);
        while (i < end) {
            callback.call(null, i);
            i += 1;
        }
        if (i < count) {
            setTimeout(chunk, 0);
        } else {
            finished.call(null);
        }
    }());
}

function aggregateData(records, callback) {
    logInfo('[STAGE_AGGREGATING] ' + (new Date()).toUTCString());
    var sheets = {},
        a;
    var progress_current = 0;
    var progress_total = records.length;

    if (records.length < 1) {
        logError("No records found")
    }

    yieldingLoop(records.length, 1000, function(r) {
        logDebug('aggregateData: ' + r + '/' + records.length)
        var record = records[r], // one record in the xml
            type, // the type of the record
            sheet, // object containing the csv table
            columns, // the columns of the csv table
            rows, // the rows of the csv table
            row, // the current row for the csv table
            attribute; // the current attribute being added to the csv table

        // find type attribute
        if (record.attributes.type !== undefined) {
            type = record.attributes.type.value;
            if (type) {
                if (sheets[type] === undefined) {
                    sheets[type] = { columns: [], rows: [] };
                }
                sheet = sheets[type];
                columns = sheet.columns;
                rows = sheet.rows;
                row = {};
                for (a = 0; a < record.attributes.length; a += 1) {
                    attribute = record.attributes[a];
                    if (columns.indexOf(attribute.name) === -1) {
                        columns.push(attribute.name);
                    }
                    row[attribute.name] = attribute.value;
                    if (attribute.value.indexOf(',') > -1) {
                        CSV_SEPARATOR = ';'
                    }
                }
                rows.push(row);
            } else {
                logError("Invalid record type at index: " + r)
            }
        } else {
            logError("No type attribute at index: " + r)
        }
        progress_current += 1;
        setProgress(STAGE_AGGREGATING, progress_current / progress_total);
    }, function() {
        callback(null, sheets);
    });
}

function generateCSV(sheets, numRecords) {
    logInfo('[STAGE_GENERATING] ' + (new Date()).toUTCString());

    var types = Object.keys(sheets), // the types from the xml
        type, // the current type
        sheet, // the sheet containing the data for the current type
        col, // the current column
        row, // the current row
        csv, // the string containing the final csv
        blob, // the blob of the csv used for saving a file
        /* DOM elements */
        table_body, // the tbody
        table_row, // the tr
        table_col, // the td
        download_col, // the table column containing the download link
        download_link, // the a
        download_icon, // the i
        /* Iterators */
        t, // the type iterator
        r, // the row iterator
        c; // the coluimn iterator

    var progress_current = 0;
    var progress_total = numRecords;

    table_body = document.createElement('tbody');
    table.replaceChild(table_body, table.firstElementChild);

    if (types.length < 1) {
        logError("No types found")
    }

    yieldingLoop(types.length, 1, function(t) {
        logDebug('generateCSV: ' + t + '/' + types.length)
        type = types[t];
        csv = '';
        csv += 'sep=' + CSV_SEPARATOR + NEWLINE;

        sheet = sheets[type];
        csv += sheet.columns.join(CSV_SEPARATOR) + NEWLINE;

        for (r = 0; r < sheet.rows.length; r += 1) {
            row = sheet.rows[r];
            for (c = 0; c < sheet.columns.length; c += 1) {
                col = sheet.columns[c];
                if (row[col] !== undefined) {
                    csv += row[col];
                }
                if ((c + 1) < sheet.columns.length) { // last column
                    csv += CSV_SEPARATOR;
                }
            }
            csv += NEWLINE;
            progress_current += 1;
            setProgress(STAGE_GENERATING, progress_current / progress_total);
        }
        blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });

        table_row = document.createElement('tr');

        table_col = document.createElement('td');
        table_col.innerHTML = type;
        table_row.appendChild(table_col);

        download_col = document.createElement('td');
        download_link = document.createElement('a');
        download_link.classList.add('download-link');
        download_icon = createElementFromHTML('<svg class="download-icon" enable-background="new 0 0 24 24" fill="#000000" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><rect width="24" height="24" fill="none"/><path d="M16.59,9H15V4c0-0.55-0.45-1-1-1h-4C9.45,3,9,3.45,9,4v5H7.41c-0.89,0-1.34,1.08-0.71,1.71l4.59,4.59 c0.39,0.39,1.02,0.39,1.41,0l4.59-4.59C17.92,10.08,17.48,9,16.59,9z M5,19c0,0.55,0.45,1,1,1h12c0.55,0,1-0.45,1-1s-0.45-1-1-1H6 C5.45,18,5,18.45,5,19z"/></svg>');
        download_link.appendChild(download_icon);
        download_link.href = window.URL.createObjectURL(blob);
        download_link.setAttribute('download', 'fileName');
        download_link.download = type + '.csv'

        download_col.appendChild(download_link);
        table_row.appendChild(download_col);

        table_body.appendChild(table_row);
    }, function() {
        logInfo('[STAGE_FINISHED] ' + (new Date()).toUTCString());
        setProgress(STAGE_FINISHED, 1);
        anchor.scrollIntoView({
            behavior: 'smooth'
        });
    });
}

function extractRecords(line, records) {
    var xml = parser.parseFromString(line, 'text/html');
    var recordNodes = xml.getElementsByTagName('Record');

    for (var r = 0; r < recordNodes.length; r++) {
        var recordNode = recordNodes[r];
        var record = { attributes: [] };
        records.push(record);

        for (var a = 0; a < recordNode.attributes.length; a++) {
            var attribNode = recordNode.attributes[a];
            var attribute = {
                name: attribNode.name.trim(),
                value: attribNode.value.trim()
            }
            record.attributes.push(attribute);

            if (attribute.name === 'type') {
                record.attributes.type = attribute;
            }

        }

        var metadataNodes = recordNode.getElementsByTagName('MetadataEntry');
        for (var m = 0; m < metadataNodes.length; m++) {
            var metadataNode = metadataNodes[m];

            var attribute = {
                name: metadataNode.getAttribute('key').trim(),
                value: metadataNode.getAttribute('value').trim(),
            }
            record.attributes.push(attribute);
        }
    }
}

function readFileRecordByRecord(file, callback) {
    logInfo('[STAGE_READING] ' + (new Date()).toUTCString());
    logDebug("[start] function readFileRecordByRecord(file, callback)");
    var CHUNK_SIZE = 1 * 1024 * 1024;
    logInfo("[readFileRecordByRecord] file.size: " + file.size);
    logInfo("[readFileRecordByRecord] chunk_size: " + CHUNK_SIZE);

    if (file.size > 1 * 1024 * 1024 * 1024) {
        callback('Unfortunately your export file is too large (' + (file.size / 1024 / 1024 / 1024).toFixed(1) + 'GB) to be handled in most browsers!\nThe limit on my laptop is around 1GB.\n\nI strongly encourage you to check out the app as an alternative :)');
        return
    }

    var offset = 0;
    var reader = new FileReader();
    var remainingWindow = new Uint8Array();
    var records = [];

    setProgress(STAGE_READING, 0);

    function concatBuffer(buffer1, buffer2) {
        var tmp = new Uint8Array(buffer1.byteLength + buffer2.byteLength);
        tmp.set(buffer1);
        tmp.set(buffer2, buffer1.byteLength);
        return tmp;
    }

    reader.onload = function(ev) {
        const buffer = new Uint8Array(ev.target.result);
        var textWindow = concatBuffer(remainingWindow, buffer);
        var textOffset = 0;

        for (var i = textWindow.length - 1; i > 0; i--) {
            var character = textWindow[i];
            if (character === 0x0A || character === 0x0D) {
                textOffset = i;
                const lineSlice = textWindow.subarray(0, i);
                const line = decoder.decode(lineSlice);
                extractRecords(line, records);
                break;
            }
        }

        remainingWindow = textWindow.subarray(textOffset);
        setProgress(STAGE_READING, offset / file.size);
        offset += CHUNK_SIZE;
        seek();
    }
    reader.onerror = function(ev) {
        logError('[readFileRecordByRecord] reader.onerror: ' + JSON.stringify(ev));
        logError('[readFileRecordByRecord] Error reading file "' + JSON.stringify(file) + '" at offset: ' + JSON.stringify(offset));
        callback('Error reading file "' + file + '" at offset: ' + offset);
    }
    seek();

    function seek() {
        if (offset >= file.size) {
            setProgress(STAGE_READING, 1);
            callback(null, records);
            return;
        }
        // logDebug('[slice] [' + offset + ':' + (offset + CHUNK_SIZE) + '] ' + file.size);
        var slice = file.slice(offset, offset + CHUNK_SIZE);
        reader.readAsArrayBuffer(slice);
    }

}

dropzone.addEventListener('click', function(e) {
    input.click();
    e.preventDefault();
}, false);

input.addEventListener('change', function() {
    readFileRecordByRecord(this.files[0], function(err, records) {
        if (err) {
            logError(err)
            alert(err)
            return;
        }
        aggregateData(records, function(err, sheets) {
            if (err) {
                logError(err)
                alert(err)
                return;
            }
            generateCSV(sheets, records.length);
        });
    });
}, false);