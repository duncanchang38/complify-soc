// Code.gs

const SETTINGS_TITLE = "⚙️ Settings"
const SIDEBAR_TITLE = "✨ Complify"
/**
 * Runs when the spreadsheet is opened.
 */
function onOpen() {
  SpreadsheetApp.getUi()
      .createAddonMenu()  // this goes under the extension
      .addItem('Ask a Question', 'showSidebar')
      .addItem('Settings', 'showSettings')
      .addSeparator()     // Optional: for a nice visual break
      .addToUi();
}


/**
 * Runs when the add-on is installed; calls onOpen() to ensure menu creation and
 * any other initializion work is done immediately.
 *
 * @param {Object} e The event parameter for a simple onInstall trigger.
 */
function onInstall(e) {
  onOpen(e);
}


/**
 * Shows a popup for settings.
 */
function showSettings() {
  console.log("[Code.gs] showSettings() opening")
  const ui = HtmlService.createTemplateFromFile('settings')
    .evaluate()
    .setWidth(400)
    .setHeight(190)
    .setSandboxMode(HtmlService.SandboxMode.IFRAME);

  SpreadsheetApp.getUi().showModalDialog(ui, SETTINGS_TITLE)
}

/**
 * Shows a sidebar in the spreadsheet.
 */
function showSidebar() {

  console.log("[Code.gs] showSidebar() opening")
  const ui = HtmlService.createTemplateFromFile('sidebar')
    .evaluate()
    .setTitle(SIDEBAR_TITLE)
    .setSandboxMode(HtmlService.SandboxMode.IFRAME);

  SpreadsheetApp.getUi().showSidebar(ui);
}


/**
 * Writes a given value to a specified cell or range.
 * @param {string} answer The text to write into the cell.
 * @param {string} cellA1Notation The A1 notation of the target cell (e.g., "C5").
 * @returns {string} A success message.
 */
function writeAnswerToSheet(answer, cellA1Notation) {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    sheet.getRange(cellA1Notation).setValue(answer);
    return `Successfully updated ${cellA1Notation}.`;
  } catch (e) {
    console.error("writeAnswerToSheet Error: " + e.toString());
    throw new Error("Failed to write to the sheet. Please ensure the cell reference is valid.");
  }
}

/**
 * Gets the A1 notation of the user's currently active range.
 * @returns {string} The A1 notation of the selected range (e.g., "B2:C10").
 */
function getActiveRangeA1Notation() {
  try {
    const range = SpreadsheetApp.getActiveRange();
    return range.getA1Notation();
  } catch (e) {
    console.error("getActiveRangeA1Notation Error: " + e.toString());
    // Return a default or error value if no range is active
    return "A1"; 
  }
}

/**
 * This will get ALL data from your active sheet and log the formatted prompt.
 */
function getCellsContent() {

  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();

  // Dynamically get all cells in the sheet that have data.
  const range = sheet.getDataRange(); 
  
  // converts the range content into a 2D array.
  const values = range.getValues();
  
  // Pass the data and the range object to the formatter function
  const prompt = formatSheetDataForLLM(values, range);

  return prompt
}

/**
 * Formats the 2D array of sheet data into a structured prompt for an LLM.
 * (This function remains unchanged, as it's already dynamic)
 * * @param {Array<Array<any>>} values The 2D array of data from range.getValues().
 * @param {GoogleAppsScript.Spreadsheet.Range} range The original range object.
 * @return {string} The formatted prompt string.
 */
function formatSheetDataForLLM(values, range) {
  
  // Use an array to build the prompt string efficiently
  let promptBuilder = [];
  
  // // --- Add the LLM instructions (the "preamble") ---
  // promptBuilder.push("You are a helpful spreadsheet assistant.");
  // promptBuilder.push("Your task is to fill in the 'Answer' (Column C) for any row that has a 'Question' (Column B) and an empty 'Answer' cell.");
  // promptBuilder.push("\nHere is the current sheet data, specified by cell address and value:\n");
  
  const numRows = values.length;
  const numCols = values[0].length;
  
  const sheetData = []; // This will be our main array
  const sheet_map = {}

  // --- Loop through the 2D array ---
  for (let r = 0; r < numRows; r++) { // r is the row index (0-based)
    
    let rowData = []; // This array will hold one row of cell objects

    for (let c = 0; c < numCols; c++) { // c is the column index (0-based)
      
      // Get the specific cell from the range object (1-based index)
      // This is how we find the "A1" style address for each value.
      let cellAddress = range.getCell(r + 1, c + 1).getA1Notation();
      
      // Get the corresponding value from the array
      let cellValue = values[r][c];

      // Add the cell object to the row array
      // rowData.push({
      //   cell: cellAddress,
      //   value: cellValue
      // });
      rowData.push({
        cellAddress: cellValue
      });
      sheet_map[cellAddress] = cellValue
      
    }
    
    sheetData.push(rowData);
  }
  
  // --- Add the final instructions for the JSON output ---
  // promptBuilder.push("\nPlease provide your answers in a strict JSON array format, where each object specifies the `cell` to write to and the `value` to insert. Only include cells that need to be filled.");
  // promptBuilder.push("\nExample Response Format:");
  // promptBuilder.push('`[ { "cell": "C2", "value": "Paris" }, { "cell": "C3", "value": "4" } ]`');
  
  // Join the array into a single string with newline characters
  const jsonString = JSON.stringify(sheet_map);
  return jsonString;
}


function getKnowledgeBaseAnswer(user_prompt, cell) {

  // const cellContent = getActiveCellsContent(cell)
  const cellContent = getCellsContent()
  console.log(`cellContent: ${cellContent}`)
  // const selectedCellRange = getActiveCellRange(cell)

  console.log(`Calling getKnowledgeBaseAnswer with user_prompt: ${user_prompt}`)
  const apiKey = "KEY"; 
  const url = "https://api.dify.ai/v1/chat-messages";
  // ---------------------
  
  // 1. Define the headers
  const headers = {
    "Authorization": "Bearer " + apiKey,
    "Content-Type": "application/json"
  };

  // 2. Define the payload as a JavaScript object
  const payloadObject = {
    "inputs": {
      "queryRange": cell
    },
    "query": cellContent,
    "response_mode": "blocking", // Apps Script will wait for this to finish
    "conversation_id": "",
    "user": "duncan.c",
  };

  // 3. Set up the options for UrlFetchApp
  const options = {
    "method": "post",
    "headers": headers,
    "payload": JSON.stringify(payloadObject), // Convert the object to a JSON string
    "muteHttpExceptions": true // Set to true to see error responses
  };

  const response = UrlFetchApp.fetch(url, options);
  const responseCode = response.getResponseCode();
  const responseBody = response.getContentText();
  console.log(`response code: ${responseCode}`);
  console.log(`response body: ${responseBody}`)

  if (responseCode === 200) {
    const parsedResponse = JSON.parse(responseBody);
    const answer = parsedResponse.answer;
    console.log(`[Code.gs] getKnowledgeBaseAnswer() -- ${answer}`)

    return answer;
  } else {
    throw new Error(`API Error: ${responseBody}`);
  }



}

function getActiveCellsContent(cell) {
  // Step 1: Get the text from the specified cell/range in the sheet.
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const range = sheet.getRange(cell);
  
  // Use getDisplayValues() to get text from multiple cells.
  const cellValues = range.getDisplayValues(); 
  
  // Convert the 2D array of cell values into a single block of text.
  const cellText = cellValues.map(row => row.join('\t')).join('\n');

  return cellText
}

function getActiveCellRange(cell) {
  // Step 1: Get the text from the specified cell/range in the sheet.
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const range = sheet.getRange(cell);
  return range
}


/**
 * Calls the OpenAI API and writes the answer to the specified cell.
 * @param {string} question The question to ask the AI.
 * @param {string} cell The cell range selected.
 * @return {string} A success message.
 */
function getOpenAiAnswer(user_prompt, cell) {
  try {
    console.log(`Calling getOpenAiAnswer with user_prompt: ${user_prompt}`)
    const apiUrl = 'https://api.openai.com/v1/chat/completions';
    const apiKey = 'KEY'
    // Step 1: Get the text from the specified cell/range in the sheet.
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    const range = sheet.getRange(cell);
    
    // Use getDisplayValues() to get text from multiple cells.
    const cellValues = range.getDisplayValues(); 
    
    // Convert the 2D array of cell values into a single block of text.
    const cellText = cellValues.map(row => row.join('\t')).join('\n');

    const system_prompt = `Update the content ${cellText} based on user prompt.`
    const payload = {
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: user_prompt }, {role: 'system', content: system_prompt}],
      temperature: 0.7,
    };

    const options = {
      'method': 'post',
      'contentType': 'application/json',
      'headers': {
        'Authorization': 'Bearer ' + apiKey,
      },
      'payload': JSON.stringify(payload),
      'muteHttpExceptions': true // Important to catch API errors
    };

    const response = UrlFetchApp.fetch(apiUrl, options);
    const responseCode = response.getResponseCode();
    const responseBody = response.getContentText();
    console.log(`response code: ${responseCode}`);

    if (responseCode === 200) {
      const parsedResponse = JSON.parse(responseBody);
      const answer = parsedResponse.choices[0].message.content.trim();
      console.log(`[Code.gs] getOpenAiAnswer() -- ${answer}`)

      return answer;
    } else {
      throw new Error(`API Error: ${responseBody}`);
    }
   
  } catch (e) {
    console.error(e);
    throw new Error(`An error occurred: ${e.message}`);
  }
}

