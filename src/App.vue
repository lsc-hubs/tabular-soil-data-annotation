<template>
  <v-app>
    <v-container class="pa-6" max-width="1200">
      <v-row>
        <v-col>
        <h1 class="text-h5 mb-4">Tabular Soil Data Annotation</h1>
        <v-alert type="info" class="mb-6" dense>
        <ol class="pl-6">
        <li>Choose the input mode: single CSV, linked CSVs, or Excel workbook.</li>
        <li>Upload your CSV or Excel file(s).</li>
        <li>If relevant, import an existing metadata file</li>
        <li>The table below lists each column in your dataset.</li>
        <li>Annotate each column with type, element, unit, method.</li>
        <li>The <strong>data type</strong> column auto-suggests string, numeric, or date based on sample values.</li>
        <li>Save annotated metadata as CSV, <a href="https://specs.frictionlessdata.io//table-schema/" target=_blank>TableSchema</a>, 
        or <a href="https://csvw.org" target=_blank>CSVW</a>.</li>
        <li>Linked CSVs mode allows connecting site and observation files.</li>
        <li>Excel mode auto-detects the header row and sheet structure.</li>
        </ol>
        </v-alert>
        </v-col>
      </v-row>

      <v-row class="mb-4">
        <v-col cols="12" md="6">
          <v-radio-group v-model="mode" row>
            <v-radio label="Single CSV" value="single" />
            <v-radio label="Linked CSVs" value="linked" />
            <v-radio label="Excel workbook" value="excel" />
          </v-radio-group>
        </v-col>
      </v-row>

      <v-row>
        <v-col cols="12" md="6" v-if="mode==='single'">
          <v-file-input accept=".csv,text/csv" label="Upload CSV" @change="onSingleCSV" prepend-icon="mdi-file-upload" />
        </v-col>

        <v-col cols="12" md="6" v-if="mode==='linked'">
          <v-file-input accept=".csv" label="Site CSV (locations)" @change="onSiteCSV" prepend-icon="mdi-database" />
          <v-file-input accept=".csv" label="Concentration CSV" @change="onConcCSV" prepend-icon="mdi-database" class="mt-3" />

          <v-row v-if="siteHeaders.length && concHeaders.length" class="mt-3">
            <v-col cols="6">
              <v-select :items="siteHeaders" v-model="siteIdCol" label="Site ID column (site CSV)" dense class="pa-0" />
            </v-col>
            <v-col cols="6">
              <v-select :items="concHeaders" v-model="concIdCol" label="Conc ID column (conc CSV)" dense class="pa-0" />
            </v-col>
          </v-row>
        </v-col>

        

        <v-col cols="12" md="6" v-if="mode==='excel'">
          <v-file-input accept=".xlsx,.xls" label="Upload Excel workbook" @change="onExcel" prepend-icon="mdi-file-excel" />
          <v-select v-if="sheets.length" :items="sheets" v-model="selectedSheet" label="Select sheet" class="mt-3 pa-0" dense />
        </v-col>
      </v-row>

      <v-row v-if="columns.length" class="mt-6">
        <v-col>
          <v-card>
            <v-toolbar flat dense>
              <v-file-input
                accept=".csv,.json"
                label="Import metadata"
                prepend-icon="mdi-file-import"
                @change="onImportMetadata"
                dense
                hide-details
                class="mx-2"
              />
              <v-spacer />
              <v-btn color="primary" class="ml-2" @click="downloadCSVMetadata">Save as CSV</v-btn>
              <v-btn color="primary" class="ml-2" @click="downloadTableSchema">Save as tableschema</v-btn>
              <v-btn color="primary" class="ml-2" @click="downloadCSVW">Save as CSVW</v-btn>
            </v-toolbar>
          </v-card>
        </v-col>
        </v-row>

        <v-row v-if="columns.length" class="mt-6">
          <v-col>
            <v-data-table :headers="tableHeaders" :items="columns" item-key="name" dense class="elevation-0">

              <template #item.name="{ item }">
                <div class="font-weight-medium">{{ item.name }}</div>
              </template>

              <template #item.sample="{ item }">
                <div><small>{{ item.sample }}</small></div>
              </template>

              <template #item.datatype="{ item }">
                <v-select
                  :items="dataTypeOptions"
                  v-model="item.datatype"
                  density="compact"
                  hide-details
                />
              </template>

              <template #item.element="{ item }">
                <v-combobox
                  :items="elementSuggestions"
                  v-model="item.element"
                  density="compact"
                  hide-details
                />
              </template>

              <template #item.unit="{ item }">
                <v-combobox
                  :items="unitSuggestions"
                  v-model="item.unit"
                  density="compact"
                  hide-details
                />
              </template>

              <template #item.method="{ item }">
                <v-combobox
                  :items="methodSuggestions"
                  v-model="item.method"
                  density="compact"
                  hide-details
                />
              </template>

            </v-data-table>
         
        </v-col>
      </v-row>

      <v-row v-else class="mt-6">
        <v-col>
          <v-alert type="info">No file loaded yet.</v-alert>
        </v-col>
      </v-row>

    </v-container>
  </v-app>
</template>

<script>
import { ref, reactive, onMounted } from 'vue'
import Papa from 'papaparse'
import * as XLSX from 'xlsx'

export default {
  name: 'App',
  setup() {
    const mode = ref('single')
    const columns = reactive([])

    // keep the parsed data rows for datatype detection
    const parsedRows = ref([])

    const siteHeaders = ref([])
    const concHeaders = ref([])
    const siteIdCol = ref('')
    const concIdCol = ref('')

    const sheets = ref([])
    const selectedSheet = ref('')

    const elementSuggestions = ref([])
    const unitSuggestions = ref([])
    const methodSuggestions = ref([])
 
    const dataTypeOptions = ['string', 'numeric', 'date']

    const tableHeaders = [
      { title: 'Column', value: 'name', width: '220'},
      { title: 'Sample', value: 'sample' },
      { title: 'Data type', value: 'datatype' },
      { title: 'Measured element', value: 'element' },
      { title: 'Unit', value: 'unit' },
      { title: 'Method', value: 'method' }
    ]

    // load vocabularies from public/data
    async function loadVocabularies() {
      try {
        const [elements] = await Promise.all([
          fetch('/tabular-soil-data-annotation/assets/keywords.json').then(r => r.json())
        ])
        elementSuggestions.value = elements.properties
        unitSuggestions.value = elements.units
        methodSuggestions.value = elements.procedures
      } catch (e) {
        console.error('Failed to load vocabularies', e)
      }
    }

    onMounted(() => loadVocabularies())

    function onImportMetadata(e) {
      const file = e?.target?.files?.[0]
      if (!file) return

      const reader = new FileReader()
      reader.onload = ev => {
        const text = ev.target.result
        const fileName = file.name.toLowerCase()

        try {
          if (fileName.endsWith('.csv')) {
            // Parse CSV metadata file
            const parsed = Papa.parse(text, { header: true })
            if (parsed.data && parsed.data.length) {
              parsed.data.forEach(row => {
                const col = columns.find(c => c.name === row.name)
                if (col) {
                  col.element = row.element || ''
                  col.unit = row.unit || ''
                  col.method = row.method || ''
                  col.description = row.description || ''
                  col.datatype = row.datatype || col.datatype
                }
              })
            }
          } else if (fileName.endsWith('.json')) {
            const json = JSON.parse(text)

            // TableSchema format
            if (json.fields) {
              json.fields.forEach(field => {
                const col = columns.find(c => c.name === field.name)
                if (col) {
                  col.datatype = field.type || col.datatype
                  col.description = field.description || ''
                  col.unit = field.unit || ''
                  col.method = field.method || ''
                  col.element = field.element || ''
                }
              })
            }

            // CSVW format
            if (json.tableSchema && json.tableSchema.columns) {
              json.tableSchema.columns.forEach(field => {
                const col = columns.find(c => c.name === field.name)
                if (col) {
                  col.datatype = field.datatype || col.datatype
                  col.description = field.description || ''
                  col.unit = field.unit || ''
                  col.method = field.method || ''
                  col.element = field.element || ''
                }
              })
            }
          } else {
            alert('Unsupported file format. Please upload CSV or JSON.')
          }
        } catch (err) {
          console.error('Error importing metadata:', err)
          alert('Failed to parse metadata file.')
        }
      }
      reader.readAsText(file)
    }


    function methodsForColumn(col){
      const el = (col.element||'').toLowerCase()
      return methodSuggestions.value
    }

    function onElementChange(col){
      const el = (col.element||'').toLowerCase()
      if(/\b(p|phosphorus)\b/.test(el) || /\b(k|potassium)\b/.test(el) || /\b(ca|calcium)\b/.test(el) || /\b(mg|magnesium)\b/.test(el) || /\b(s|sulfur)\b/.test(el)){
        if(!col.unit) col.unit = 'mg/kg'
      }
      if(/carbon|c\b/.test(el)){
        if(!col.unit) col.unit = '%'
      }
    }

    function resetMetadata(){
      columns.forEach(c=>{
        c.element = ''
        c.unit = ''
        c.method = ''
        c.datatype = 'string'
      })
    }

    // robust file extraction for v-file-input (Vuetify) and native inputs
    function fileFromInput(e) {
      if (!e) return null
      if (e instanceof File) return e
      if (Array.isArray(e) && e.length) return e[0]
      if (e && e.target && e.target.files && e.target.files[0]) return e.target.files[0]
      return null
    }

    function onSingleCSV(e){
      const f = fileFromInput(e)
      if(!f) return
      Papa.parse(f, {
        header: true,
        dynamicTyping: false,
        complete: (results)=>{
          const data = results.data
          parsedRows.value = data
          handleParsedTable(results.meta.fields || Object.keys(data[0] || {}), data)
        },
        error: (err)=> console.error('PapaParse error:', err)
      })
    }

    function onSiteCSV(e){
      const f = fileFromInput(e)
      if(!f) return
      Papa.parse(f, {
        header: true,
        complete: (results)=>{
          siteHeaders.value = results.meta.fields || Object.keys(results.data[0]||{})
        },
        error: (err)=> console.error('PapaParse site CSV error', err)
      })
    }

    function onConcCSV(e){
      const f = fileFromInput(e)
      if(!f) return
      Papa.parse(f, {
        header: true,
        complete: (results)=>{
          concHeaders.value = results.meta.fields || Object.keys(results.data[0]||{})
          const sampleRow = results.data[0] || {}
          parsedRows.value = results.data
          buildColumnsFromHeaders(results.meta.fields || Object.keys(sampleRow), sampleRow)
        },
        error: (err)=> console.error('PapaParse conc CSV error', err)
      })
    }

    function onExcel(e){
      const f = fileFromInput(e)
      if(!f) return
      const reader = new FileReader()
      reader.onload = (ev)=>{
        const data = new Uint8Array(ev.target.result)
        const workbook = XLSX.read(data, {type:'array'})
        sheets.value = workbook.SheetNames
        selectedSheet.value = workbook.SheetNames[0]
        parseExcelSheet(workbook, selectedSheet.value)
      }
      reader.onerror = (err)=> console.error('FileReader error', err)
      reader.readAsArrayBuffer(f)
    }

    function parseExcelSheet(workbook, sheetName){
      const ws = workbook.Sheets[sheetName]
      const json = XLSX.utils.sheet_to_json(ws, {header:1, defval: ''})
      let headerRowIndex = 0
      for(let r=0;r<Math.min(10,json.length);r++){
        const row = json[r]
        const nonEmpty = row.filter(c=>c!=='' && c!=null).length
        if(nonEmpty >= (row.length/2) && nonEmpty>0){ headerRowIndex = r; break }
      }
      const headers = json[headerRowIndex].map(h=>String(h).trim()||`col${Math.random().toString(36).slice(2,6)}`)
      const dataRows = json.slice(headerRowIndex+1).map(r=>{
        const obj = {}
        headers.forEach((h,i)=> obj[h] = r[i])
        return obj
      })
      parsedRows.value = dataRows
      handleParsedTable(headers, dataRows)
    }

    function handleParsedTable(headers, data){
      columns.splice(0, columns.length)
      headers.forEach(h=>{
        const sample = getColumnSample(data, h)
        const detected = detectColumnType(h, data)
        columns.push({name: h, sample, element:'', unit:'', method:'', datatype: detected})
      })
    }

    function buildColumnsFromHeaders(headers, sampleRow){
      columns.splice(0, columns.length)
      headers.forEach(h=>{
        const sample = sampleRow[h] || ''
        const detected = detectColumnType(h, parsedRows.value)
        columns.push({name: h, sample, element:'', unit:'', method:'', datatype: detected})
      })
    }

    function getColumnSample(data, header){
      for(const r of data){
        if(r && r[header] !== null && r[header] !== undefined && String(r[header]).trim()!=='') return String(r[header]).slice(0,40)
      }
      return ''
    }

    // Detect datatype by scanning parsed rows for the given header
    function detectColumnType(header, data){
      if(!data || !data.length) return 'string'
      let numericCount = 0
      let dateCount = 0
      let total = 0
      const numericRe = /^[-+]?\d+(?:[\\.,]\\d+)?$/
      for(const row of data){
        if(!row) continue
        const v = row[header]
        if(v===null || v===undefined || String(v).trim()==='') continue
        total++
        const s = String(v).trim()
        // numeric test (allow comma decimal)
        if(numericRe.test(s)) numericCount++
        else {
          // try date parse — treat as date if Date.parse succeeds and string contains typical date separators
          const maybe = Date.parse(s)
          if(!Number.isNaN(maybe) && /[\/-]/.test(s)) dateCount++
        }
      }
      if(total===0) return 'string'
      // thresholds
      if(numericCount/total >= 0.8) return 'numeric'
      if(dateCount/total >= 0.8) return 'date'
      return 'string'
    }

    function downloadCSVMetadata(){
      const rows = [['name','element','unit','method','datatype']]
      columns.forEach(c=> rows.push([c.name, c.element||'', c.unit||'', c.method||'', c.datatype||'']))

      const csv = rows
        .map(r => r.map(cell => `\"${String(cell).replace(/\"/g, '\"\"')}\"`).join(','))
        .join('\n')

      triggerDownload(csv, 'metadata.csv', 'text/csv')
    }

    function downloadTableSchema(){
      const schema = {
        fields: columns.map(c=>{
          const f = {name: c.name}
          if(c.element) f.title = c.element
          if(c.unit) f.unit = c.unit
          if(c.method) f.method = c.method
          if(c.datatype) f.type = c.datatype
          return f
        }),
        primaryKey: null
      }
      const json = JSON.stringify(schema, null, 2)
      triggerDownload(json, 'tableschema.json', 'application/json')
    }

    function downloadCSVW(){
      const csvw = {
        "@context": "http://www.w3.org/ns/csvw",
        "url": "data.csv",
        "tableSchema": {
          "columns": columns.map(c=>{
            const col = {name: c.name}
            if(c.element) col.titles = [c.element]
            if(c.unit) col.unit = c.unit
            if(c.method) col.method = c.method
            if(c.datatype) col.datatype = c.datatype
            return col
          })
        }
      }
      triggerDownload(JSON.stringify(csvw, null, 2), 'csvw.json', 'application/json')
    }

    function triggerDownload(text, filename, mime){
      const blob = new Blob([text], {type: mime || 'text/plain'})
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    }

    return {
      mode, columns, elementSuggestions, unitSuggestions, methodSuggestions, onImportMetadata,
      methodsForColumn, onElementChange, resetMetadata, onSingleCSV, onSiteCSV, onConcCSV, onExcel,
      siteHeaders, concHeaders, siteIdCol, concIdCol, sheets, selectedSheet, downloadCSVMetadata, downloadTableSchema, downloadCSVW, tableHeaders, dataTypeOptions
    }
  }
}
</script>

<style>
.v-application { font-family: Inter, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial; }
.pa-0 .v-input__control { padding-top: 0 !important; padding-bottom: 0 !important; }
.v-data-table__td { padding:0px !important; margin:0px !important; }
.v-table > .v-table__wrapper > table > tbody > tr > td { padding: 0px 0px !important; }
.v-input--horizontal { padding-bottom: 0px !important }
</style>
