const fs = require('fs');

// Read existing
let content = fs.readFileSync('db.js', 'utf8');
let dbMatch = content.match(/const LOCAL_DB = (\[[\s\S]*?\]);/);
if (!dbMatch) {
    console.error("Could not find LOCAL_DB array in db.js");
    process.exit(1);
}

let db = [];
try {
    // using eval to parse because it might have trailing commas or lack quotes on keys
    eval(`db = ${dbMatch[1]};`);
} catch(e) {
    console.error(e);
    process.exit(1);
}

// Map of known corrections (domain -> { fmt?, weight? })
const corrections = {
    "uab.edu": { fmt: "flast", weight: 60 },
    "samford.edu": { fmt: "firstlast" },
    "harding.edu": { fmt: "flast" },
    "uams.edu": { fmt: "first.last", weight: 60 },
    "atsu.edu": { fmt: "flast" },
    "midwestern.edu": { fmt: "flast", weight: 50 },
    "nau.edu": { fmt: "first.last" },
    "stanfordhealthcare.org": { fmt: "flast", weight: 200 },
    "stanford.edu": { fmt: "flast", weight: 100 },
    "mednet.ucla.edu": { fmt: "flast", weight: 200 },
    "med.usc.edu": { fmt: "flast", weight: 100 },
    "ucsf.edu": { fmt: "first.last", weight: 200 },
    "kp.org": { fmt: "first.last", weight: 150 },
    "cshs.org": { fmt: "first.last", weight: 150 },
    "llu.edu": { fmt: "firstlast" },
    "ucdavis.edu": { fmt: "first.last", weight: 80 },
    "chapman.edu": { fmt: "flast" },
    "calbaptist.edu": { fmt: "flast" },
    "ketchum.edu": { fmt: "first.last" },
    "samuelmerritt.edu": { fmt: "firstlast" },
    "tu.edu": { fmt: "first.last" },
    "westernu.edu": { fmt: "flast", weight: 50 },
    "cuanschutz.edu": { fmt: "first.last", weight: 80 },
    "yale.edu": { fmt: "first.last", weight: 150 },
    "ynhh.org": { fmt: "first.last", weight: 150 },
    "gwu.edu": { fmt: "flast", weight: 80 },
    "howard.edu": { fmt: "first.last" },
    "ufl.edu": { fmt: "flast", weight: 100 },
    "fsu.edu": { fmt: "flast", weight: 60 },
    "nova.edu": { fmt: "firstlast", weight: 80 },
    "barry.edu": { fmt: "flast" },
    "fiu.edu": { fmt: "flast" },
    "usf.edu": { fmt: "flast" },
    "emory.edu": { fmt: "first.last", weight: 100 },
    "emoryhealthcare.org": { fmt: "first.last", weight: 150 },
    "mercer.edu": { fmt: "first.last" },
    "augusta.edu": { fmt: "flast" },
    "msm.edu": { fmt: "flast" },
    "uiowa.edu": { fmt: "first.last", weight: 80 },
    "dmu.edu": { fmt: "first.last", weight: 50 },
    "rush.edu": { fmt: "first.last", weight: 150 },
    "nm.org": { fmt: "first.last", weight: 150 },
    "northwestern.edu": { fmt: "flast", weight: 100 },
    "siu.edu": { fmt: "first.last" },
    "rosalindfranklin.edu": { fmt: "first.last" },
    "iu.edu": { fmt: "flast", weight: 100 },
    "iuhealth.org": { fmt: "first.last", weight: 150 },
    "butler.edu": { fmt: "flast" },
    "indstate.edu": { fmt: "first.last" },
    "wichita.edu": { fmt: "first.last" },
    "uky.edu": { fmt: "first.last", weight: 80 },
    "sullivan.edu": { fmt: "flast" },
    "lsuhsc.edu": { fmt: "flast", weight: 60 },
    "lsuhs.edu": { fmt: "flast", weight: 50 },
    "bu.edu": { fmt: "flast", weight: 100 },
    "mgh.harvard.edu": { fmt: "flast", weight: 200 },
    "bwh.harvard.edu": { fmt: "first.last", weight: 150 },
    "bidmc.harvard.edu": { fmt: "flast", weight: 100 },
    "tufts.edu": { fmt: "first.last", weight: 80 },
    "northeastern.edu": { fmt: "f.last", weight: 80 },
    "mcphs.edu": { fmt: "first.last", weight: 60 },
    "mghihp.edu": { fmt: "flast" },
    "jhmi.edu": { fmt: "flast", weight: 200 },
    "umaryland.edu": { fmt: "first.last", weight: 80 },
    "towson.edu": { fmt: "flast" },
    "aacc.edu": { fmt: "first.last" },
    "une.edu": { fmt: "firstlast" },
    "med.umich.edu": { fmt: "first.last", weight: 150 },
    "wmich.edu": { fmt: "first.last", weight: 60 },
    "wayne.edu": { fmt: "flast", weight: 60 },
    "gvsu.edu": { fmt: "first.last" },
    "cmich.edu": { fmt: "first.last" },
    "emich.edu": { fmt: "flast" },
    "mayo.edu": { fmt: "last.first", weight: 250 },
    "augsburg.edu": { fmt: "lastf", weight: 40 },
    "stkate.edu": { fmt: "firstlast", weight: 40 },
    "bjc.org": { fmt: "first.last", weight: 150 },
    "slu.edu": { fmt: "first.last", weight: 60 },
    "umkc.edu": { fmt: "first.last", weight: 60 },
    "missouristate.edu": { fmt: "first.last" },
    "mc.edu": { fmt: "firstlast" },
    "umc.edu": { fmt: "flast", weight: 70 },
    "duke.edu": { fmt: "first.last", weight: 150 },
    "unchealth.unc.edu": { fmt: "first.last", weight: 150 },
    "unc.edu": { fmt: "flast", weight: 120 },
    "wakehealth.edu": { fmt: "first.last", weight: 80 },
    "ecu.edu": { fmt: "lastf", weight: 60 },
    "campbell.edu": { fmt: "flast", weight: 50 },
    "elon.edu": { fmt: "flast" },
    "unmc.edu": { fmt: "first.last", weight: 80 },
    "creighton.edu": { fmt: "first.last" },
    "rutgers.edu": { fmt: "first.last", weight: 80 },
    "shu.edu": { fmt: "first.last" },
    "unm.edu": { fmt: "flast", weight: 60 },
    "unr.edu": { fmt: "first.last" },
    "mountsinai.org": { fmt: "first.last", weight: 180 },
    "nyulangone.org": { fmt: "first.last", weight: 180 },
    "northwell.edu": { fmt: "first.last", weight: 150 },
    "med.cornell.edu": { fmt: "first.last", weight: 100 },
    "stonybrook.edu": { fmt: "first.last", weight: 80 },
    "downstate.edu": { fmt: "first.last", weight: 70 },
    "upstate.edu": { fmt: "first.last", weight: 70 },
    "hofstra.edu": { fmt: "first.last" },
    "amc.edu": { fmt: "flast" },
    "pace.edu": { fmt: "flast" },
    "rit.edu": { fmt: "first.last" },
    "ccf.org": { fmt: "lastf", weight: 250 },
    "osumc.edu": { fmt: "first.last", weight: 180 },
    "cchmc.org": { fmt: "first.last", weight: 120 },
    "utoledo.edu": { fmt: "first.last", weight: 60 },
    "ohio.edu": { fmt: "first.last", weight: 60 },
    "case.edu": { fmt: "first.last", weight: 70 },
    "udayton.edu": { fmt: "first.last" },
    "ou.edu": { fmt: "first.last", weight: 70 },
    "ohsu.edu": { fmt: "lastf", weight: 200 },
    "providence.org": { fmt: "first.last", weight: 100 },
    "lhs.org": { fmt: "flast", weight: 100 },
    "pacificu.edu": { fmt: "flast" },
    "pennmedicine.upenn.edu": { fmt: "first.last", weight: 200 },
    "upmc.edu": { fmt: "first.last", weight: 200 },
    "chop.edu": { fmt: "first.last", weight: 150 },
    "drexel.edu": { fmt: "flast", weight: 80 },
    "jefferson.edu": { fmt: "first.last", weight: 80 },
    "pitt.edu": { fmt: "flast", weight: 80 },
    "psu.edu": { fmt: "flast", weight: 80 },
    "temple.edu": { fmt: "first.last", weight: 70 },
    "pcom.edu": { fmt: "first.last", weight: 60 },
    "musc.edu": { fmt: "first.last", weight: 70 },
    "sc.edu": { fmt: "first.last", weight: 60 },
    "usd.edu": { fmt: "first.last" },
    "vumc.org": { fmt: "first.last", weight: 200 },
    "uthsc.edu": { fmt: "flast", weight: 80 },
    "lmunet.edu": { fmt: "first.last" },
    "southcollege.edu": { fmt: "first.last" },
    "houstonmethodist.org": { fmt: "first.last", weight: 180 },
    "texaschildrens.org": { fmt: "first.last", weight: 150 },
    "bcm.edu": { fmt: "first.last", weight: 100 },
    "uthscsa.edu": { fmt: "lastf", weight: 80 },
    "unthsc.edu": { fmt: "first.last", weight: 80 },
    "utsouthwestern.edu": { fmt: "first.last", weight: 80 },
    "utmb.edu": { fmt: "first.last", weight: 70 },
    "ttuhsc.edu": { fmt: "first.last", weight: 70 },
    "utah.edu": { fmt: "flast", weight: 80 },
    "inova.org": { fmt: "first.last", weight: 150 },
    "sentara.com": { fmt: "first.last", weight: 120 },
    "evms.edu": { fmt: "lastf", weight: 70 },
    "jmu.edu": { fmt: "lastf", weight: 50 },
    "su.edu": { fmt: "flast" },
    "seattlechildrens.org": { fmt: "first.last", weight: 120 },
    "uw.edu": { fmt: "flast", weight: 100 },
    "wisc.edu": { fmt: "first.last", weight: 80 },
    "uwlax.edu": { fmt: "flast" },
    "marquette.edu": { fmt: "first.last" },
    "wvu.edu": { fmt: "first.last", weight: 60 }
};

// Also let's systematically adjust formats of programs not explicitly overridden
// Common rules:
// - Most modern large institutions use first.last
// - Older state schools sometimes use flast
// Let's do a pass
db.forEach(item => {
    // apply specific overrides
    if (corrections[item.domain]) {
        if (corrections[item.domain].fmt) item.fmt = corrections[item.domain].fmt;
        if (corrections[item.domain].weight) item.weight = corrections[item.domain].weight;
    } else {
        // If it's a hospital, default first.last
        if (item.type === 'hospital' && item.fmt !== 'first.last') {
            item.fmt = 'first.last';
        }
        // If it's a program and it's 'firstlast', let's change to 'first.last' as it's way more common
        if (item.type === 'program' && item.fmt === 'firstlast') {
             item.fmt = 'first.last';
        }
    }
});

// Let's add some missing top-tier ones just to be safe
const toAdd = [
    { inst: "Massachusetts General Hospital", city: "Boston", state: "MA", domain: "mgh.harvard.edu", fmt: "flast", type: "hospital", weight: 200 },
    { inst: "Johns Hopkins Medicine", city: "Baltimore", state: "MD", domain: "jhmi.edu", fmt: "flast", type: "hospital", weight: 200 },
    { inst: "University of Washington", city: "Seattle", state: "WA", domain: "uw.edu", fmt: "flast", type: "program", weight: 150 },
    { inst: "Mayo Clinic", city: "Rochester", state: "MN", domain: "mayo.edu", fmt: "last.first", type: "hospital", weight: 250 },
];

toAdd.forEach(newItem => {
    if (!db.find(x => x.domain === newItem.domain && x.inst === newItem.inst)) {
        db.push(newItem);
    }
});

let outStr = "const LOCAL_DB = [\n";
db.forEach((d, i) => {
    outStr += "    " + JSON.stringify(d) + (i === db.length - 1 ? "" : ",\n");
});
outStr += "\n];\n";

fs.writeFileSync('db.js', outStr, 'utf8');
console.log(`Updated db.js with ${db.length} entries.`);

