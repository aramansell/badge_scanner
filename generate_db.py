import json

# A massive list of PA programs by State
pa_programs = [
    # AL
    ("University of Alabama at Birmingham", "Birmingham", "AL"),
    ("University of South Alabama", "Mobile", "AL"),
    ("Samford University", "Birmingham", "AL"),
    ("Faulkner University", "Montgomery", "AL"),
    # AR
    ("Harding University", "Searcy", "AR"),
    ("UAMS", "Little Rock", "AR"),
    ("University of Arkansas for Medical Sciences", "Little Rock", "AR"),
    # AZ
    ("A.T. Still University", "Mesa", "AZ"),
    ("Midwestern University", "Glendale", "AZ"),
    ("Northern Arizona University", "Phoenix", "AZ"),
    # CA
    ("Loma Linda University", "Loma Linda", "CA"),
    ("Marshall B. Ketchum University", "Fullerton", "CA"),
    ("Samuel Merritt University", "Oakland", "CA"),
    ("Southern California University of Health Sciences", "Whittier", "CA"),
    ("Stanford University", "Stanford", "CA"),
    ("Touro University California", "Vallejo", "CA"),
    ("UC Davis", "Sacramento", "CA"),
    ("USC Keck School of Medicine", "Los Angeles", "CA"),
    ("Western University of Health Sciences", "Pomona", "CA"),
    ("UCSF", "San Francisco", "CA"),
    ("California Baptist University", "Riverside", "CA"),
    ("Chapman University", "Irvine", "CA"),
    ("Charles R. Drew University", "Los Angeles", "CA"),
    ("Dominican University of California", "San Rafael", "CA"),
    ("Point Loma Nazarene University", "San Diego", "CA"),
    ("University of La Verne", "La Verne", "CA"),
    ("University of the Pacific", "Sacramento", "CA"),
    # CO
    ("Red Rocks Community College", "Arvada", "CO"),
    ("University of Colorado", "Aurora", "CO"),
    ("Colorado Mesa University", "Grand Junction", "CO"),
    ("Rocky Vista University", "Parker", "CO"),
    # CT
    ("Quinnipiac University", "Hamden", "CT"),
    ("Sacred Heart University", "Fairfield", "CT"),
    ("University of Bridgeport", "Bridgeport", "CT"),
    ("University of Saint Joseph", "West Hartford", "CT"),
    ("Yale University", "New Haven", "CT"),
    ("Yale School of Medicine", "New Haven", "CT"),
    # DC
    ("George Washington University", "Washington", "DC"),
    ("Howard University", "Washington", "DC"),
    # FL
    ("Barry University", "Miami Shores", "FL"),
    ("Florida Gulf Coast University", "Fort Myers", "FL"),
    ("Florida International University", "Miami", "FL"),
    ("Florida State University", "Tallahassee", "FL"),
    ("Nova Southeastern University", "Fort Lauderdale", "FL"),
    ("South University", "Tampa", "FL"),
    ("South University - West Palm Beach", "West Palm Beach", "FL"),
    ("University of Florida", "Gainesville", "FL"),
    ("AdventHealth University", "Orlando", "FL"),
    ("Florida State University", "Tallahassee", "FL"),
    ("Keiser University", "Fort Lauderdale", "FL"),
    ("Miami Dade College", "Miami", "FL"),
    ("University of South Florida", "Tampa", "FL"),
    ("University of Tampa", "Tampa", "FL"),
    # GA
    ("Augusta University", "Augusta", "GA"),
    ("Emory University", "Atlanta", "GA"),
    ("Mercer University", "Atlanta", "GA"),
    ("PCOM Georgia", "Suwanee", "GA"),
    ("South University", "Savannah", "GA"),
    ("Brenau University", "Gainesville", "GA"),
    ("Morehouse School of Medicine", "Atlanta", "GA"),
    # ID
    ("Idaho State University", "Pocatello", "ID"),
    ("College of Idaho", "Caldwell", "ID"),
    # IL
    ("Midwestern University", "Downers Grove", "IL"),
    ("Northwestern University", "Chicago", "IL"),
    ("Rosalind Franklin University", "North Chicago", "IL"),
    ("Rush University", "Chicago", "IL"),
    ("Southern Illinois University", "Carbondale", "IL"),
    ("Dominican University", "River Forest", "IL"),
    ("Malcolm X College", "Chicago", "IL"),
    # IN
    ("Butler University", "Indianapolis", "IN"),
    ("Indiana State University", "Terre Haute", "IN"),
    ("Indiana University", "Indianapolis", "IN"),
    ("University of Evansville", "Evansville", "IN"),
    ("Franklin College", "Franklin", "IN"),
    ("University of Saint Francis", "Fort Wayne", "IN"),
    ("Valparaiso University", "Valparaiso", "IN"),
    # IA
    ("Des Moines University", "Des Moines", "IA"),
    ("University of Iowa", "Iowa City", "IA"),
    ("St. Ambrose University", "Davenport", "IA"),
    ("University of Dubuque", "Dubuque", "IA"),
    # KS
    ("Wichita State University", "Wichita", "KS"),
    ("Kansas State University", "Manhattan", "KS"),
    # KY
    ("University of Kentucky", "Lexington", "KY"),
    ("Sullivan University", "Louisville", "KY"),
    ("University of the Cumberlands", "Williamsburg", "KY"),
    # LA
    ("LSU Health Sciences Center New Orleans", "New Orleans", "LA"),
    ("LSU Health Sciences Center Shreveport", "Shreveport", "LA"),
    ("Our Lady of the Lake College", "Baton Rouge", "LA"),
    ("Xavier University of Louisiana", "New Orleans", "LA"),
    # ME
    ("University of New England", "Portland", "ME"),
    # MD
    ("Anne Arundel Community College", "Arnold", "MD"),
    ("Frostburg State University", "Frostburg", "MD"),
    ("Towson University", "Towson", "MD"),
    ("University of Maryland", "Baltimore", "MD"),
    ("University of Maryland Eastern Shore", "Princess Anne", "MD"),
    # MA
    ("Bay Path University", "Longmeadow", "MA"),
    ("Boston University", "Boston", "MA"),
    ("MGH Institute of Health Professions", "Boston", "MA"),
    ("Northeastern University", "Boston", "MA"),
    ("Springfield College", "Springfield", "MA"),
    ("Tufts University", "Boston", "MA"),
    ("Westfield State University", "Westfield", "MA"),
    ("Massachusetts College of Pharmacy and Health Sciences", "Boston", "MA"),
    # MI
    ("Central Michigan University", "Mount Pleasant", "MI"),
    ("Eastern Michigan University", "Ypsilanti", "MI"),
    ("Grand Valley State University", "Grand Rapids", "MI"),
    ("University of Detroit Mercy", "Detroit", "MI"),
    ("Wayne State University", "Detroit", "MI"),
    ("Western Michigan University", "Kalamazoo", "MI"),
    ("Concordia University Ann Arbor", "Ann Arbor", "MI"),
    ("Michigan State University", "East Lansing", "MI"),
    # MN
    ("Augsburg University", "Minneapolis", "MN"),
    ("Bethel University", "St. Paul", "MN"),
    ("College of St. Scholastica", "Duluth", "MN"),
    ("Mayo Clinic School of Health Sciences", "Rochester", "MN"),
    ("St. Catherine University", "St. Paul", "MN"),
    # MS
    ("Mississippi College", "Clinton", "MS"),
    ("University of Mississippi Medical Center", "Jackson", "MS"),
    # MO
    ("A.T. Still University", "Kirksville", "MO"),
    ("Missouri State University", "Springfield", "MO"),
    ("Saint Louis University", "St. Louis", "MO"),
    ("Stephens College", "Columbia", "MO"),
    ("University of Missouri-Kansas City", "Kansas City", "MO"),
    # NE
    ("College of Saint Mary", "Omaha", "NE"),
    ("Creighton University", "Omaha", "NE"),
    ("Union College", "Lincoln", "NE"),
    ("University of Nebraska Medical Center", "Omaha", "NE"),
    # NV
    ("Touro University Nevada", "Henderson", "NV"),
    ("University of Nevada, Reno", "Reno", "NV"),
    # NH
    ("Franklin Pierce University", "West Lebanon", "NH"),
    ("Massachusetts College of Pharmacy and Health Sciences", "Manchester", "NH"),
    # NJ
    ("Monmouth University", "West Long Branch", "NJ"),
    ("Rutgers University", "Piscataway", "NJ"),
    ("Seton Hall University", "Nutley", "NJ"),
    ("College of Saint Elizabeth", "Morristown", "NJ"),
    # NM
    ("University of New Mexico", "Albuquerque", "NM"),
    ("University of St. Francis", "Albuquerque", "NM"),
    # NY
    ("Albany Medical College", "Albany", "NY"),
    ("Clarkson University", "Potsdam", "NY"),
    ("Cornell University", "New York", "NY"),
    ("Daemen College", "Amherst", "NY"),
    ("D'Youville College", "Buffalo", "NY"),
    ("Hofstra University", "Hempstead", "NY"),
    ("Le Moyne College", "Syracuse", "NY"),
    ("Marist College", "Poughkeepsie", "NY"),
    ("Mercy College", "Bronx", "NY"),
    ("New York Institute of Technology", "Old Westbury", "NY"),
    ("Pace University", "New York", "NY"),
    ("Rochester Institute of Technology", "Rochester", "NY"),
    ("St. John's University", "Queens", "NY"),
    ("Stony Brook University", "Stony Brook", "NY"),
    ("SUNY Downstate", "Brooklyn", "NY"),
    ("SUNY Upstate", "Syracuse", "NY"),
    ("Touro College", "Bay Shore", "NY"),
    ("Wagner College", "Staten Island", "NY"),
    ("Binghamton University", "Binghamton", "NY"),
    ("Canisius College", "Buffalo", "NY"),
    ("CUNY York College", "Jamaica", "NY"),
    ("D'Youville University", "Buffalo", "NY"),
    ("Ithaca College", "Ithaca", "NY"),
    ("LIU Brooklyn", "Brooklyn", "NY"),
    ("St. John Fisher College", "Rochester", "NY"),
    # NC
    ("Campbell University", "Buies Creek", "NC"),
    ("Duke University", "Durham", "NC"),
    ("East Carolina University", "Greenville", "NC"),
    ("Elon University", "Elon", "NC"),
    ("High Point University", "High Point", "NC"),
    ("Methodist University", "Fayetteville", "NC"),
    ("UNC Chapel Hill", "Chapel Hill", "NC"),
    ("Wake Forest University", "Winston-Salem", "NC"),
    ("Wingate University", "Wingate", "NC"),
    ("Lenoir-Rhyne University", "Hickory", "NC"),
    ("Pfeiffer University", "Albemarle", "NC"),
    ("Gardner-Webb University", "Boiling Springs", "NC"),
    # ND
    ("University of North Dakota", "Grand Forks", "ND"),
    # OH
    ("Baldwin Wallace University", "Berea", "OH"),
    ("Case Western Reserve University", "Cleveland", "OH"),
    ("Kettering College", "Kettering", "OH"),
    ("Marietta College", "Marietta", "OH"),
    ("Mount Union", "Alliance", "OH"),
    ("Ohio Dominican University", "Columbus", "OH"),
    ("Ohio University", "Dublin", "OH"),
    ("University of Dayton", "Dayton", "OH"),
    ("University of Mount Union", "Alliance", "OH"),
    ("University of Toledo", "Toledo", "OH"),
    ("Lake Erie College", "Painesville", "OH"),
    ("Ursuline College", "Pepper Pike", "OH"),
    ("Ashland University", "Ashland", "OH"),
    ("Cedarville University", "Cedarville", "OH"),
    # OK
    ("Oklahoma City University", "Oklahoma City", "OK"),
    ("University of Oklahoma", "Oklahoma City", "OK"),
    ("University of Oklahoma-Tulsa", "Tulsa", "OK"),
    # OR
    ("OHSU", "Portland", "OR"),
    ("Pacific University", "Hillsboro", "OR"),
    ("George Fox University", "Newberg", "OR"),
    # PA
    ("Arcadia University", "Glenside", "PA"),
    ("Chatham University", "Pittsburgh", "PA"),
    ("DeSales University", "Center Valley", "PA"),
    ("Drexel University", "Philadelphia", "PA"),
    ("Duquesne University", "Pittsburgh", "PA"),
    ("Gannon University", "Erie", "PA"),
    ("King's College", "Wilkes-Barre", "PA"),
    ("Lock Haven University", "Lock Haven", "PA"),
    ("Marywood University", "Scranton", "PA"),
    ("Mercyhurst University", "Erie", "PA"),
    ("Misericordia University", "Dallas", "PA"),
    ("Penn State University", "Hershey", "PA"),
    ("Philadelphia College of Osteopathic Medicine", "Philadelphia", "PA"),
    ("Salus University", "Elkins Park", "PA"),
    ("Seton Hill University", "Greensburg", "PA"),
    ("Slippery Rock University", "Slippery Rock", "PA"),
    ("Thomas Jefferson University", "Philadelphia", "PA"),
    ("University of Pittsburgh", "Pittsburgh", "PA"),
    ("University of the Sciences", "Philadelphia", "PA"),
    ("Alvernia University", "Reading", "PA"),
    ("Carlow University", "Pittsburgh", "PA"),
    ("Holy Family University", "Philadelphia", "PA"),
    ("Indiana University of Pennsylvania", "Indiana", "PA"),
    ("Moravian University", "Bethlehem", "PA"),
    ("Saint Francis University", "Loretto", "PA"),
    ("Temple University", "Philadelphia", "PA"),
    ("West Chester University", "West Chester", "PA"),
    ("Widener University", "Chester", "PA"),
    # SC
    ("Medical University of South Carolina", "Charleston", "SC"),
    ("North Greenville University", "Greer", "SC"),
    ("Presbyterian College", "Clinton", "SC"),
    ("University of South Carolina", "Columbia", "SC"),
    # SD
    ("University of South Dakota", "Vermillion", "SD"),
    # TN
    ("Bethel University", "Paris", "TN"),
    ("Christian Brothers University", "Memphis", "TN"),
    ("Lincoln Memorial University", "Harrogate", "TN"),
    ("Lincoln Memorial University-Knoxville", "Knoxville", "TN"),
    ("South College", "Knoxville", "TN"),
    ("South College-Nashville", "Nashville", "TN"),
    ("Trevecca Nazarene University", "Nashville", "TN"),
    ("University of Tennessee Health Science Center", "Memphis", "TN"),
    ("Milligan University", "Milligan", "TN"),
    ("Lipscomb University", "Nashville", "TN"),
    # TX
    ("Baylor College of Medicine", "Houston", "TX"),
    ("Hardin-Simmons University", "Abilene", "TX"),
    ("Texas Tech University Health Sciences Center", "Midland", "TX"),
    ("University of North Texas Health Science Center", "Fort Worth", "TX"),
    ("University of Texas Medical Branch", "Galveston", "TX"),
    ("University of Texas Rio Grande Valley", "Edinburg", "TX"),
    ("University of Texas Southwestern", "Dallas", "TX"),
    ("UT Health San Antonio", "San Antonio", "TX"),
    ("Mary Hardin-Baylor", "Belton", "TX"),
    ("Texas Tech University Health Sciences Center", "Lubbock", "TX"),
    ("University of Mary Hardin-Baylor", "Belton", "TX"),
    ("West Coast University-Texas", "Richardson", "TX"),
    ("Texas A&M University", "College Station", "TX"),
    # UT
    ("Rocky Mountain University of Health Professions", "Provo", "UT"),
    ("University of Utah", "Salt Lake City", "UT"),
    ("Utah Valley University", "Orem", "UT"),
    # VT
    ("Franklin Pierce University", "West Lebanon", "NH"),
    # VA
    ("Eastern Virginia Medical School", "Norfolk", "VA"),
    ("James Madison University", "Harrisonburg", "VA"),
    ("Radford University", "Roanoke", "VA"),
    ("Shenandoah University", "Winchester", "VA"),
    ("University of Lynchburg", "Lynchburg", "VA"),
    ("Emory & Henry College", "Marion", "VA"),
    ("Mary Baldwin University", "Fishersville", "VA"),
    ("South University", "Richmond", "VA"),
    # WA
    ("University of Washington", "Seattle", "WA"),
    ("Heritage University", "Toppenish", "WA"),
    ("MEDEX Northwest", "Seattle", "WA"),
    # WV
    ("Alderson Broaddus University", "Philippi", "WV"),
    ("University of Charleston", "Charleston", "WV"),
    ("West Liberty University", "West Liberty", "WV"),
    ("West Virginia University", "Morgantown", "WV"),
    # WI
    ("Carroll University", "Waukesha", "WI"),
    ("Concordia University Wisconsin", "Mequon", "WI"),
    ("Marquette University", "Milwaukee", "WI"),
    ("University of Wisconsin-La Crosse", "La Crosse", "WI"),
    ("University of Wisconsin-Madison", "Madison", "WI"),
]

# Hospitals
hospitals = [
    ("Kaiser Permanente", "San Francisco", "CA", "kp.org", "first.last"),
    ("UCLA Health", "Los Angeles", "CA", "mednet.ucla.edu", "first.last"),
    ("Cedars-Sinai", "Los Angeles", "CA", "cshs.org", "first.last"),
    ("Mass General Hospital", "Boston", "MA", "mgh.harvard.edu", "flast"),
    ("NYU Langone", "New York", "NY", "nyulangone.org", "first.last"),
    ("Mount Sinai", "New York", "NY", "mountsinai.org", "first.last"),
    ("Northwell Health", "New Hyde Park", "NY", "northwell.edu", "first.last"),
    ("UNC Health", "Chapel Hill", "NC", "unchealth.unc.edu", "first.last"),
    ("Cleveland Clinic", "Cleveland", "OH", "ccf.org", "lastf"),
    ("Ohio State University Wexner", "Columbus", "OH", "osumc.edu", "first.last"),
    ("Penn Medicine", "Philadelphia", "PA", "pennmedicine.upenn.edu", "first.last"),
    ("Houston Methodist", "Houston", "TX", "houstonmethodist.org", "first.last"),
    ("Swedish Medical Center", "Seattle", "WA", "swedish.org", "first.last"),
    ("Providence", "Seattle", "WA", "providence.org", "first.last"),
    ("Legacy Health", "Portland", "OR", "lhs.org", "flast"),
    ("Providence Portland", "Portland", "OR", "providence.org", "first.last"),
    ("Inova Health", "Falls Church", "VA", "inova.org", "first.last"),
    ("Sentara Healthcare", "Norfolk", "VA", "sentara.com", "first.last"),
    ("Mayo Clinic", "Rochester", "MN", "mayo.edu", "first.last"),
    ("Johns Hopkins", "Baltimore", "MD", "jhmi.edu", "flast"),
    ("Emory Healthcare", "Atlanta", "GA", "emoryhealthcare.org", "first.last"),
    ("Stanford Health Care", "Stanford", "CA", "stanfordhealthcare.org", "first.last"),
    ("UCSF Health", "San Francisco", "CA", "ucsf.edu", "first.last"),
    ("Duke Health", "Durham", "NC", "duke.edu", "first.last"),
    ("Vanderbilt University Medical Center", "Nashville", "TN", "vumc.org", "first.last"),
    ("Northwestern Medicine", "Chicago", "IL", "nm.org", "first.last"),
    ("Rush University Medical Center", "Chicago", "IL", "rush.edu", "first.last"),
    ("Michigan Medicine", "Ann Arbor", "MI", "med.umich.edu", "first.last"),
    ("Barnes-Jewish Hospital", "St. Louis", "MO", "bjc.org", "first.last"),
    ("Brigham and Women's Hospital", "Boston", "MA", "bwh.harvard.edu", "first.last"),
    ("Beth Israel Deaconess Medical Center", "Boston", "MA", "bidmc.harvard.edu", "first.last"),
    ("UPMC", "Pittsburgh", "PA", "upmc.edu", "first.last"),
    ("Yale New Haven Hospital", "New Haven", "CT", "ynhh.org", "first.last"),
    ("Indiana University Health", "Indianapolis", "IN", "iuhealth.org", "first.last"),
    ("Banner Health", "Phoenix", "AZ", "bannerhealth.com", "first.last"),
    ("Texas Children's Hospital", "Houston", "TX", "texaschildrens.org", "first.last"),
    ("Children's Hospital of Philadelphia", "Philadelphia", "PA", "chop.edu", "first.last"),
    ("Cincinnati Children's", "Cincinnati", "OH", "cchmc.org", "first.last"),
    ("Seattle Children's", "Seattle", "WA", "seattlechildrens.org", "first.last"),
    ("Boston Children's Hospital", "Boston", "MA", "childrens.harvard.edu", "first.last"),
]

# Load universities domains
with open('us_universities.json', 'r') as f:
    univ_data = json.load(f)

# Map university name to domain
domain_map = {}
for u in univ_data:
    name = u['name']
    domains = u['domains']
    if domains:
        domain_map[name] = domains[0]

# Add some explicit mappings that might be missing or named differently
explicit_map = {
    "UAMS": "uams.edu",
    "USC Keck School of Medicine": "usc.edu",
    "UCSF": "ucsf.edu",
    "OHSU": "ohsu.edu",
    "SUNY Downstate": "downstate.edu",
    "SUNY Upstate": "upstate.edu",
    "Penn State University": "psu.edu",
    "UNC Chapel Hill": "unc.edu",
    "LSU Health Sciences Center New Orleans": "lsuhsc.edu",
    "LSU Health Sciences Center Shreveport": "lsuhs.edu",
    "Yale School of Medicine": "yale.edu",
    "Mayo Clinic School of Health Sciences": "mayo.edu",
    "A.T. Still University": "atsu.edu",
    "MGH Institute of Health Professions": "mghihp.edu",
    "Rutgers University": "rutgers.edu",
    "CUNY York College": "york.cuny.edu",
    "University of Oklahoma-Tulsa": "ou.edu",
    "University of Arkansas for Medical Sciences": "uams.edu",
    "University of California, Davis": "ucdavis.edu",
    "UC Davis": "ucdavis.edu",
    "PCOM Georgia": "pcom.edu",
    "Philadelphia College of Osteopathic Medicine": "pcom.edu",
}
domain_map.update(explicit_map)

db_entries = []

# Process programs
for inst, city, state in pa_programs:
    domain = domain_map.get(inst)
    if not domain:
        # try matching partial
        for k, v in domain_map.items():
            if inst.lower() in k.lower() or k.lower() in inst.lower():
                domain = v
                break
    if not domain:
        domain = inst.lower().replace(" ", "").replace(".", "") + ".edu"
    
    # default fmt for newly added is first.last
    fmt = "first.last"
    
    db_entries.append({
        "inst": inst,
        "city": city,
        "state": state,
        "domain": domain,
        "fmt": fmt,
        "type": "program"
    })

# Process hospitals
for inst, city, state, domain, fmt in hospitals:
    db_entries.append({
        "inst": inst,
        "city": city,
        "state": state,
        "domain": domain,
        "fmt": fmt,
        "type": "hospital"
    })

# Overwrite db_entries domains/fmts if we already had them in the current db.js
# I will just write them to a new file and manually append/merge or I can do it in python
import re
with open('db.js', 'r') as f:
    old_db_js = f.read()

old_entries = []
# parse the existing JSON-like structure
matches = re.findall(r'\{\s*inst:\s*"([^"]+)",\s*city:\s*"([^"]+)",\s*state:\s*"([^"]+)",\s*domain:\s*"([^"]+)",\s*fmt:\s*"([^"]+)",\s*type:\s*"([^"]+)"\s*\}', old_db_js)
for m in matches:
    old_entries.append({
        "inst": m[0],
        "city": m[1],
        "state": m[2],
        "domain": m[3],
        "fmt": m[4],
        "type": m[5]
    })

# Merge: if old_entry exists, update the new db_entries with old's domain and fmt
for new_e in db_entries:
    for old_e in old_entries:
        if new_e['inst'] == old_e['inst']:
            new_e['domain'] = old_e['domain']
            new_e['fmt'] = old_e['fmt']

# Add any old entries that were completely missed in the new list
new_inst_names = {e['inst'] for e in db_entries}
for old_e in old_entries:
    if old_e['inst'] not in new_inst_names:
        db_entries.append(old_e)

# Sort by state, then type, then inst
db_entries.sort(key=lambda x: (x['state'], x['type'], x['inst']))

with open('db.js', 'w') as f:
    f.write("const LOCAL_DB = [\n")
    for e in db_entries:
        f.write(f'    {{ inst: "{e["inst"]}", city: "{e["city"]}", state: "{e["state"]}", domain: "{e["domain"]}", fmt: "{e["fmt"]}", type: "{e["type"]}" }},\n')
    f.write("];\n")

print(f"Generated {len(db_entries)} entries in db.js")
