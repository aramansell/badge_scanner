const fs = require('fs');
eval(fs.readFileSync('db.js', 'utf8'));

function localDbLookup(parsed) {
    const city = (parsed.city || "").trim().toLowerCase();
    const state = (parsed.state || "").trim().toLowerCase();
    const company = (parsed.company || "").trim().toLowerCase();

    let candidates = [];
    
    if (city && state) {
        candidates = LOCAL_DB.filter(db => 
            db.city.toLowerCase() === city && 
            db.state.toLowerCase() === state
        );
    }
    
    // Check if we can find the company directly
    let directMatch = null;
    if (company) {
        directMatch = LOCAL_DB.find(db => company.includes(db.inst.toLowerCase()) || db.inst.toLowerCase().includes(company));
        if (directMatch && !candidates.find(c => c.inst === directMatch.inst)) {
            candidates.push(directMatch);
        }
    }
    
    // Sort by weight descending, giving priority to direct match
    candidates.sort((a, b) => {
        if (directMatch) {
            if (a.inst === directMatch.inst) return -1;
            if (b.inst === directMatch.inst) return 1;
        }
        return (b.weight || 0) - (a.weight || 0);
    });
    
    return candidates;
}

console.log(localDbLookup({ city: 'Portland', state: 'OR' }));
