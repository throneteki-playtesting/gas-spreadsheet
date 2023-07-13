# Playtesting Spreadsheet (GAS)
All processes associated with the latest playtesting project for the aGoT Design Team. To be linked to a Google App Script which is connected to the latest Google Sheet document.

## Contributing
_Note that the below instructions are relevant for Windows._
### Pre-requisites
In order to contribute, you will need the following installed & configured:
- Your prefered code editor (Visual Studio Code is recommended)
- Node Package Manager (npm) - _Successfully tested with 16.20.0_
- Clasp - https://github.com/google/clasp

### Getting Started
Fork & clone this repository, then:
- Open prefered command line program (eg. cmd)
- Navigate to your repository directory
- Run `npm install`

Ensure that the script id set in `clasp.json` is configured appropriately to your Google App Script's id:
```js
{
    "scriptId": "1rdas11vc8Og2dtQ2gtypy_xPxZPRWRrWCyjBWog37sNdg3JKv9MMr_Cn" // <--- Change this
}
```
Your script can be found in your Google App Script's project settings, or in the URL:
![image](https://github.com/throneteki-playtesting/playtesting-spreadsheet/assets/23492047/736ae44f-20f3-45d7-8ac3-8c2b508dc9a5)

### Pushing changes
Simply run `clasp push` to push changes to the target script. **Please be careful where you push this, as the playtesting spreadsheet code should not be overridden without permission**.
