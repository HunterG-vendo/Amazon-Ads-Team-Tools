#!/usr/bin/env python3
"""Builds the Claude skill and the copy-paste prompts from tools/skill/.

Run from the repo root:  python tools/build_skill.py
Writes:
  downloads/amazon-ads-team-tools-hub-editor.skill   (the skill, for "Download the Claude skill")
  downloads/prompts/<target>.md                      (one self-contained prompt per file type, for "Copy prompt")
Edit the markdown in tools/skill/ and rerun this; never edit the generated files by hand.
"""
import os, re, zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
NAME = 'amazon-ads-team-tools-hub-editor'
SRC = os.path.join(ROOT, 'tools', 'skill', NAME)
OUT = os.path.join(ROOT, 'downloads')

def read(rel): return open(os.path.join(SRC, rel), encoding='utf-8').read()

# 1. the .skill file (a zip with the skill folder at its root)
os.makedirs(os.path.join(OUT, 'prompts'), exist_ok=True)
skill_path = os.path.join(OUT, NAME + '.skill')
with zipfile.ZipFile(skill_path, 'w', zipfile.ZIP_DEFLATED) as z:
    for folder, _, files in os.walk(SRC):
        for f in sorted(files):
            if f.endswith('.pyc') or f == '.DS_Store': continue
            full = os.path.join(folder, f)
            z.write(full, os.path.join(NAME, os.path.relpath(full, SRC)))

# 2. one prompt per upload target: the main instructions plus only the guides that file needs
body = re.sub(r'^---[\s\S]*?---\s*', '', read('SKILL.md'), count=1)
GUIDES = {
    'amc-queries': ['amc-queries.md', 'analyzer-settings.md', 'tags-and-categories.md'],
    'apps': ['apps.md', 'tags-and-categories.md'],
    'skills': ['skills.md', 'tags-and-categories.md'],
    'resources': ['resources.md'],
    'config': ['tags-and-categories.md'],
    'site': ['site-code.md'],
}
FILES = {'amc-queries': 'amc-queries.json', 'apps': 'apps.json', 'skills': 'skills.json', 'resources': 'resources.json',
         'config': 'config.json', 'site': 'index.html or the js file you are changing'}
for target, guides in GUIDES.items():
    intro = ('# Instructions for Claude: editing a PLTFRM Amazon Ads Team Tools Hub file\n\n'
             'I am attaching ' + FILES[target] + ' from the Team Tools Hub and will describe the change I want below these instructions. '
             'Follow every instruction here exactly. This is the copy-paste version of the "Amazon Ads Team Tools Hub Editor" skill: '
             'the guides it mentions as `references/...` are included further down, and the checker script is not available, so use the checklists in the guides instead of running it.\n\n---\n\n')
    parts = [intro, body.strip(), '\n']
    for g in guides:
        parts += ['\n---\n\n<!-- included guide: references/' + g + ' -->\n\n', read('references/' + g).strip(), '\n']
    parts += ['\n---\n\n## My request\n\n(Describe the change here, and attach ' + FILES[target] + '.)\n']
    open(os.path.join(OUT, 'prompts', target + '.md'), 'w', encoding='utf-8').write(''.join(parts))
print('built', os.path.relpath(skill_path, ROOT), 'and', len(GUIDES), 'prompts')
