const fs = require('fs');

let content = fs.readFileSync('db.js', 'utf8');

// Use a simple trick to evaluate the array
const arrayString = content.substring(content.indexOf('['), content.lastIndexOf(']') + 1);
const LOCAL_DB = eval(arrayString);

// Known very large/prestigious hospitals (highest weight)
const TOP_HOSPITALS = [
    'OHSU', 'Mayo Clinic', 'Johns Hopkins', 'Cleveland Clinic', 'UCLA Health',
    'Mass General Hospital', "Brigham and Women's Hospital", 'Stanford Health Care',
    'UCSF Health', 'Cedars-Sinai', 'NYU Langone', 'Mount Sinai', 'Duke Health',
    'Penn Medicine', 'UPMC', 'Northwestern Medicine', 'Rush University Medical Center',
    'Barnes-Jewish Hospital', 'Vanderbilt University Medical Center', 'Emory Healthcare',
    'Houston Methodist', "Texas Children's Hospital", 'University of Michigan',
    'Yale New Haven Hospital', 'Kaiser Permanente', 'Providence'
];

LOCAL_DB.forEach(entry => {
    let weight = 0;
    const name = entry.inst.toLowerCase();
    
    // Base weight by type
    if (entry.type === 'hospital') weight += 50;
    if (entry.type === 'program') weight += 10;
    
    // Heuristics
    if (name.includes('university') || name.includes('college')) weight += 20;
    if (name.includes('health') || name.includes('medical center') || name.includes('clinic')) weight += 30;
    if (name.includes('state')) weight += 10;
    
    // Top hospitals bonus
    if (TOP_HOSPITALS.some(h => name.includes(h.toLowerCase()))) {
        weight += 100;
    }
    
    // Explicit OHSU vs Legacy (Portland) priority
    if (name === 'ohsu') weight = 500;
    if (name === 'legacy health') weight = 50;
    
    entry.weight = weight;
});

// Format back to JS
const newArrayString = '[\n' + LOCAL_DB.map(entry => {
    return `    { inst: "${entry.inst}", city: "${entry.city}", state: "${entry.state}", domain: "${entry.domain}", fmt: "${entry.fmt}", type: "${entry.type}", weight: ${entry.weight} }`;
}).join(',\n') + '\n]';

const newContent = content.substring(0, content.indexOf('[')) + newArrayString + ';\n';
fs.writeFileSync('db.js', newContent);
console.log('Successfully updated db.js with weights.');
