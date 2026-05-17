import re
from collections import defaultdict

with open('db.js', 'r') as f:
    content = f.read()

# Extract city, state, inst
matches = re.findall(r'\{\s*inst:\s*"([^"]+)",\s*city:\s*"([^"]+)",\s*state:\s*"([^"]+)"', content)

locations = defaultdict(list)
for inst, city, state in matches:
    locations[f"{city}, {state}"].append(inst)

multiple = {loc: insts for loc, insts in locations.items() if len(insts) > 1}

print(f"Total cities with multiple institutions: {len(multiple)}")
for loc, insts in multiple.items():
    print(f"{loc}: {insts}")
