/*jslint indent: 2*/
/*global FileReader, DOMParser, Blob, saveAs*/
'use strict';
var NEWLINE = '\n';
var CSV_SEPARATOR = ',';
var dropzone = document.getElementById('dropzone');
var input = document.getElementById('input');
var table = document.getElementById('results-table');
var current_file;
var parser = new DOMParser();

var STAGE_START = 0;
var STAGE_READING = 1;
var STAGE_AGGREGATING = 2;
var STAGE_GENERATING = 3;
var STAGE_FINISHED = 4;
var STAGE_TOTAL = 3;

setProgress(0, 0);

function setProgress(stage, percent) {
  var percentage = percent;
  percentage *= 100;
  percentage = Math.round(percentage);

  if(stage === STAGE_READING) {
    dropzone.textContent = 'Running in circles... (' + percentage + '%)';
  } else if (stage === STAGE_AGGREGATING) {
    dropzone.textContent = 'Riding uphill... (' + percentage + '%)';
  } else if (stage === STAGE_GENERATING) {
    dropzone.textContent = 'Lifting weights... (' + percentage + '%)';
  } else if (stage === STAGE_FINISHED) {
    dropzone.textContent = 'Exhausted, catching a breath! (100%)';
  } else {
    dropzone.textContent = 'Select your export.xml, ready to go!';
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
  var sheets = {},
    a;
  var progress_current = 0;
  var progress_total = records.length;

  yieldingLoop(records.length, 1000, function (r) {
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
          sheets[type] = {columns: [], rows: []};
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
          if(attribute.value.indexOf(',') > -1) {
            CSV_SEPARATOR = ';'
          }
        }
        rows.push(row);
      } else {
        console.error("invalid record type");
      }
    } else {
      console.error("no type attribute");
    }
    progress_current += 1;
    setProgress(STAGE_AGGREGATING, progress_current / progress_total);
  }, function () {
    callback(null, sheets);
  });
}

function addFileLink(link_element, blob, filename) {
  link_element.addEventListener('click', function (e) {
    saveAs(blob, filename);
    e.preventDefault();
  });
}

function generateCSV(sheets, numRecords) {
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
    /* Iterators */
    t, // the type iterator
    r, // the row iterator
    c; // the coluimn iterator

  var progress_current = 0;
  var progress_total = numRecords;

  table_body = document.createElement('tbody');
  table.replaceChild(table_body, table.firstElementChild);
  yieldingLoop(types.length, 1, function (t) {
    type = types[t];
    csv = '';

    sheet = sheets[type];
    csv += sheet.columns.join(CSV_SEPARATOR) + NEWLINE;

    for (r = 0; r < sheet.rows.length; r += 1) {
      row = sheet.rows[r];
      for (c = 0; c < sheet.columns.length; c += 1) {
        col = sheet.columns[c];
        if (row[col] !== undefined) {
          csv += row[col];
        }
        if((c+1) < sheet.columns.length) { // last column
          csv += CSV_SEPARATOR;
        }
      }
      csv += NEWLINE;
      progress_current += 1;
      setProgress(STAGE_GENERATING, progress_current / progress_total);
    }
    blob = new Blob([csv], {type: 'text/csv;charset=utf-8'});

    table_row = document.createElement('tr');

    table_col = document.createElement('td');
    table_col.innerHTML = type;
    table_row.appendChild(table_col);

    download_col = document.createElement('td');
    download_link = document.createElement('a');
    download_link.className += ' icon-download';
    addFileLink(download_link, blob, type + '.csv');

    download_col.appendChild(download_link);
    table_row.appendChild(download_col);

    table_body.appendChild(table_row);
  }, function() {
    setProgress(STAGE_FINISHED, 1);
  });
}

function extractRecords(line, records) {
  var xml = parser.parseFromString(line, 'text/xml');
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

      if(attribute.name === 'type') {
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
  var optimal_size = file.size / (32*1024*1024);
  optimal_size = Math.min(optimal_size, 32*1024*1024); // max: 32MB
  optimal_size = Math.max(optimal_size, 1*1024*1024); // min: 1MB
  var CHUNK_SIZE = optimal_size;
  var offset = 0;
  var reader = new FileReader();
  var remainingWindow = new Uint8Array();
  var records = [];

  current_file = file;
  setProgress(STAGE_READING, 0);

  function concatBuffer(buffer1, buffer2) {
    var tmp = new Uint8Array(buffer1.byteLength + buffer2.byteLength);
    tmp.set(buffer1);
    tmp.set(buffer2, buffer1.byteLength);
    return tmp;
  }

  reader.onload = function(ev) {
    var textWindow = concatBuffer(remainingWindow, new Uint8Array(ev.target.result));
    var textOffset = 0;
    for (var i = 0; i < textWindow.length; i++) {
      var character = textWindow[i];
      if(character === 0x0A || character === 0x0D) {
        var lineStart = textOffset;
        var lineEnd = i;
        textOffset = i;
        var lineSlice = textWindow.subarray(lineStart, lineEnd);
        var line = Utf8ArrayToStr(lineSlice);
        extractRecords(line, records);
      }
    }
    remainingWindow = textWindow.subarray(textOffset);
    setProgress(STAGE_READING, offset/file.size);
    offset += CHUNK_SIZE;
    seek();
  }
  reader.onerror = function(ev) {
    console.log(ev, records);
    callback('Error reading file "' + file + '" at offset: ' + offset);
  }
  seek();

  function seek() {
    if (offset >= file.size) {
      setProgress(STAGE_READING, 1);
      callback(null, records);
      return;
    }
    var slice = file.slice(offset, offset + CHUNK_SIZE);
    reader.readAsArrayBuffer(slice);
  }

}

dropzone.addEventListener('click', function (e) {
  input.click();
  e.preventDefault();
}, false);

input.addEventListener('change', function () {
  readFileRecordByRecord(this.files[0], function(err, records) {
    if(err) {
      console.error(err);
      return;
    }
    aggregateData(records, function(err, sheets) {
      if(err) {
        console.error(err);
        return;
      }
      generateCSV(sheets, records.length);
    });
  });
}, false);

function Utf8ArrayToStr(array) {
  var out, i, len, c;
  var char2, char3;

  out = "";
  len = array.length;
  i = 0;
  while(i < len) {
    c = array[i++];
    switch(c >> 4)
    {
      case 0: case 1: case 2: case 3: case 4: case 5: case 6: case 7:
        // 0xxxxxxx
        out += String.fromCharCode(c);
        break;
      case 12: case 13:
        // 110x xxxx   10xx xxxx
        char2 = array[i++];
        out += String.fromCharCode(((c & 0x1F) << 6) | (char2 & 0x3F));
        break;
      case 14:
        // 1110 xxxx  10xx xxxx  10xx xxxx
        char2 = array[i++];
        char3 = array[i++];
        out += String.fromCharCode(((c & 0x0F) << 12) |
                       ((char2 & 0x3F) << 6) |
                       ((char3 & 0x3F) << 0));
        break;
    }
  }

  return out;
}
