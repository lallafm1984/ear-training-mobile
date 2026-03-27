const fs = require('fs');

const extractMeasures = (body) => {
  const cleanBody = body.replace(/\|]$/, '|').replace(/\|\s*$/, '');
  return cleanBody.split('|').map(m => m.trim()).filter(m => m.length > 0);
};

const tMeasures = extractMeasures("C4 D4 E4 F4 | G4 A4 B4 c4 | c4 B4 A4 G4 | F4 E4 D4 C4 |]");
console.log(tMeasures);

