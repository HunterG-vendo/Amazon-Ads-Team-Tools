#!/usr/bin/env python3
"""Check an edited Team Tools Hub file before it is uploaded.

Runs the same rules as the hub's Upload step (a port of js/validate.js) plus extra
checks that need the original file or the tags and categories list.

Usage:
  python check_file.py EDITED_FILE [--before ORIGINAL_FILE] [--config config.json]

Exit code 0 means no errors (warnings may remain). Exit code 1 means fix the errors first.
"""
import argparse
import base64
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile

TARGETS = {
    'amc-queries': {'label': 'AMC Queries', 'file': 'amc-queries.json', 'kind': 'data', 'noun': 'query', 'nouns': 'queries'},
    'apps': {'label': 'Apps', 'file': 'apps.json', 'kind': 'data', 'noun': 'app', 'nouns': 'apps'},
    'skills': {'label': 'Skills', 'file': 'skills.json', 'kind': 'data', 'noun': 'skill', 'nouns': 'skills'},
    'resources': {'label': 'Resources', 'file': 'resources.json', 'kind': 'data', 'noun': 'resource', 'nouns': 'resources'},
    'config': {'label': 'Home, Tags & Categories', 'file': 'config.json', 'kind': 'config', 'noun': 'tag', 'nouns': 'tags'},
}
SITE_FILES = ['index.html', 'js/core.js', 'js/validate.js', 'js/analyzer.js', 'js/tab-home.js', 'js/tab-amc.js',
              'js/tab-apps.js', 'js/tab-skills.js', 'js/tab-resources.js', 'js/manager.js']
REQUIRED_SCRIPTS = ['js/validate.js', 'js/core.js', 'js/analyzer.js', 'js/tab-home.js', 'js/tab-amc.js', 'js/tab-apps.js',
                    'js/tab-skills.js', 'js/tab-resources.js', 'js/manager.js']
RESERVED_TAGS = ['app', 'skill', 'amc query', 'resource']
ICON_IDS = ['people-plus', 'path', 'trend', 'list', 'tag', 'bars', 'pie', 'repeat', 'clock', 'calendar',
            'cart', 'dollar', 'target', 'funnel', 'layers', 'search', 'tv', 'star']
DEFAULT_CATEGORIES = ['Advanced NTB Analysis', 'LTV Analysis', 'Path To Purchase Variations', 'Other']
SIZE_WARN = 900 * 1024
FEATURED_MAX = 6
DATA_TARGETS = ['amc-queries', 'apps', 'skills', 'resources']
FIELD_NAMES = {'name': 'name', 'url': 'link', 'desc': 'description', 'author': 'author', 'tags': 'tags',
               'skillData': 'skill file', 'skillFileName': 'file name', 'title': 'title', 'type': 'category',
               'summary': 'summary', 'description': 'description', 'sql': 'SQL', 'sqlParts': 'SQL parts',
               'howTo': 'how-to steps', 'requirements': 'requirements', 'useCases': 'use cases',
               'example': 'example output', 'viz': 'analyzer settings', 'icon': 'icon', 'featured': 'featured items'}


def is_obj(v): return isinstance(v, dict)
def is_str(v): return isinstance(v, str)
def non_empty(v): return is_str(v) and v.strip() != ''
def is_http_url(v): return is_str(v) and re.match(r'^https?://[^\s/$.?#][^\s]*$', v.strip(), re.I) is not None
def is_hex(v): return is_str(v) and re.match(r'^#[0-9a-f]{6}$', v, re.I) is not None
def is_str_list(v): return isinstance(v, list) and all(is_str(x) for x in v)


def looks_like_zip_b64(v):
    if not non_empty(v):
        return False
    s = re.sub(r'\s+', '', v)
    if len(s) % 4 != 0 or not re.match(r'^[A-Za-z0-9+/]+={0,2}$', s):
        return False
    try:
        return base64.b64decode(s[:8]).startswith(b'PK')
    except Exception:
        return False


def normalize_file_name(name):
    base = re.split(r'[\\/]', str(name or ''))[-1].strip()
    return re.sub(r'\s\(\d+\)(?=\.[a-z0-9]+$)', '', base, flags=re.I)


def item_label(target, item):
    if not is_obj(item):
        return '(not an object)'
    n = item.get('title') if target == 'amc-queries' else item.get('name')
    return n if non_empty(n) else (item.get('id') if non_empty(item.get('id')) else '(untitled)')


# ---------------------------------------------------------------- site rules (same as js/validate.js)
def validate_item(target, item, tags=None):
    errors, warnings = [], []
    if not is_obj(item):
        return ['Entry is not an object.'], []
    who = '"' + item_label(target, item) + '"'
    if not non_empty(item.get('id')):
        errors.append(who + ' has no id.')
    if 'tags' in item and not is_str_list(item['tags']):
        errors.append(who + ': tags must be a list of text labels.')
    if target == 'amc-queries':
        if non_empty(item.get('id')) and not re.match(r'^[A-Za-z0-9_-]+$', item['id']):
            errors.append(who + ': id may only use letters, numbers, - and _ (it becomes part of the page link).')
        if not non_empty(item.get('title')):
            errors.append(('"' + item['id'] + '"' if non_empty(item.get('id')) else 'A query') + ' has no title.')
        parts = item.get('sqlParts')
        if 'sqlParts' in item and not isinstance(parts, list):
            errors.append(who + ': sqlParts must be a list.')
            parts = None
        parts = parts or []
        for i, p in enumerate(parts):
            if not is_obj(p):
                errors.append(who + ': SQL part ' + str(i + 1) + ' is not an object.')
            elif not non_empty(p.get('sql')):
                errors.append(who + ': SQL part ' + str(i + 1) + (' ("' + p['name'] + '")' if p.get('name') else '') + ' has no SQL.')
        with_sql = [p for p in parts if is_obj(p) and non_empty(p.get('sql'))]
        if not non_empty(item.get('sql')) and not with_sql:
            errors.append(who + ' has no SQL.')
        for k in ['howTo', 'requirements', 'useCases']:
            if k in item and not is_str_list(item[k]):
                errors.append(who + ': ' + k + ' must be a list of text lines.')
        ex = item.get('example')
        if ex is not None and 'example' in item:
            if not is_obj(ex) or not is_str_list(ex.get('columns')) or not isinstance(ex.get('rows'), list):
                errors.append(who + ': example must have columns (list) and rows (list of lists).')
            else:
                for i, r in enumerate(ex['rows']):
                    if not isinstance(r, list):
                        errors.append(who + ': example row ' + str(i + 1) + ' is not a list.')
                    elif len(r) != len(ex['columns']):
                        warnings.append(who + ': example row ' + str(i + 1) + ' has ' + str(len(r)) + ' values but ' + str(len(ex['columns'])) + ' columns.')
        if item.get('viz') is not None and 'viz' in item and not is_obj(item['viz']):
            errors.append(who + ': viz (analyzer settings) must be an object.')
        if not non_empty(item.get('type')):
            warnings.append(who + ' has no category; it will be listed under Other.')
        if not non_empty(item.get('summary')):
            warnings.append(who + ' has no summary.')
    else:
        if not non_empty(item.get('name')):
            errors.append(('"' + item['id'] + '"' if non_empty(item.get('id')) else 'An entry') + ' has no name.')
        if target == 'skills':
            has_file = non_empty(item.get('skillData'))
            if has_file and not looks_like_zip_b64(item['skillData']):
                errors.append(who + ': the stored skill file is damaged (not a valid .skill/zip file).')
            if not has_file and not is_http_url(item.get('url')):
                errors.append(who + ' needs a skill file or a link that starts with https://.')
            if non_empty(item.get('url')) and not is_http_url(item['url']):
                errors.append(who + ': link must start with https:// (got "' + item['url'] + '").')
            if has_file and not re.search(r'\.skill$', item.get('skillFileName') or '', re.I):
                warnings.append(who + ': file name should end in .skill.')
        else:
            if not non_empty(item.get('url')):
                errors.append(who + ' has no link.')
            elif not is_http_url(item['url']):
                errors.append(who + ': link must start with https:// (got "' + item['url'] + '").')
        if not non_empty(item.get('desc')):
            warnings.append(who + ' has no description.')
        if is_str_list(item.get('tags')) and tags is not None:
            known = [t.lower() for t in tags]
            for tg in item['tags']:
                if tg.lower() not in known:
                    warnings.append(who + ': tag "' + tg + '" is not in the Tags list yet. It still shows, but add it under Tags so it appears there too.')
    if not non_empty(item.get('author')) and target != 'amc-queries':
        warnings.append(who + ' has no author.')
    return errors, warnings


def validate_data(target, obj, tags=None):
    t = TARGETS[target]
    errors, warnings, checks = [], [], []
    if not is_obj(obj):
        errors.append('The file must contain a JSON object, not ' + ('a list' if isinstance(obj, list) else type(obj).__name__) + '.')
        return errors, warnings, checks
    if obj.get('file') != target:
        errors.append(('This file is marked as "' + str(obj.get('file')) + '", not "' + target + '". It may be the wrong file.') if obj.get('file')
                      else ('The file is missing "file": "' + target + '". It may not be a Team Tools file.'))
    else:
        checks.append('File is marked as ' + t['label'])
    if obj.get('schemaVersion') != 1:
        warnings.append('Unexpected schemaVersion (' + str(obj.get('schemaVersion')) + '). Expected 1.')
    if 'log' in obj and not isinstance(obj['log'], list):
        errors.append('"log" must be a list.')
    if t['kind'] == 'config':
        if not isinstance(obj.get('tags'), list):
            errors.append('"tags" must be a list.')
            return errors, warnings, checks
        seen = set()
        for i, tg in enumerate(obj['tags']):
            if not is_obj(tg) or not non_empty(tg.get('name')):
                errors.append('Tag ' + str(i + 1) + ' has no name.')
                continue
            key = tg['name'].strip().lower()
            if key in seen:
                errors.append('Tag "' + tg['name'] + '" is listed twice.')
            seen.add(key)
            if key in RESERVED_TAGS:
                errors.append('"' + tg['name'] + '" is a tab name, not a tag. Remove it.')
            if 'color' in tg and not is_hex(tg['color']):
                errors.append('Tag "' + tg['name'] + '" has an unreadable color value ("' + str(tg['color']) + '"). Remove it or use a value like #4f9eff.')
        if not errors:
            checks.append(str(len(obj['tags'])) + ' tags, all with a name')
        if 'amcCategories' in obj:
            cats = obj['amcCategories']
            if not isinstance(cats, list):
                errors.append('"amcCategories" must be a list.')
            else:
                seen_c, cat_errors = set(), 0
                for i, c in enumerate(cats):
                    if not is_obj(c) or not non_empty(c.get('name')):
                        errors.append('Category ' + str(i + 1) + ' has no name.')
                        cat_errors += 1
                        continue
                    k = c['name'].strip().lower()
                    if k in seen_c:
                        errors.append('Category "' + c['name'] + '" is listed twice.')
                        cat_errors += 1
                    seen_c.add(k)
                    if 'icon' in c and not (is_str(c['icon']) and re.match(r'^[a-z0-9-]+$', c['icon'])):
                        errors.append('Category "' + c['name'] + '" has an unreadable icon value.')
                        cat_errors += 1
                if not cat_errors:
                    checks.append(str(len(cats)) + ' AMC categories, all with a name and icon')
        if 'featured' in obj:
            fl = obj['featured']
            if not isinstance(fl, list):
                errors.append('"featured" (the home page picks) must be a list.')
            else:
                seen_f, f_errors = set(), 0
                if len(fl) > FEATURED_MAX:
                    errors.append('The home page shows up to ' + str(FEATURED_MAX) + ' featured items; this file has ' + str(len(fl)) + '.')
                    f_errors += 1
                for i, f in enumerate(fl):
                    if not is_obj(f) or f.get('target') not in DATA_TARGETS or not non_empty(f.get('id')):
                        errors.append('Featured item ' + str(i + 1) + ' needs a "target" (one of ' + ', '.join(DATA_TARGETS) + ') and an "id".')
                        f_errors += 1
                        continue
                    k = f['target'] + ':' + f['id']
                    if k in seen_f:
                        errors.append('Featured item ' + str(i + 1) + ' is listed twice (' + f['target'] + ' ' + f['id'] + ').')
                        f_errors += 1
                    seen_f.add(k)
                if not f_errors:
                    checks.append(str(len(fl)) + ' featured ' + ('item' if len(fl) == 1 else 'items') + ' for the home page')
        return errors, warnings, checks
    if not isinstance(obj.get('items'), list):
        errors.append('"items" must be a list.')
        return errors, warnings, checks
    ids, item_errors = set(), 0
    for item in obj['items']:
        e, w = validate_item(target, item, tags)
        if e:
            item_errors += 1
        errors += e
        warnings += w
        if is_obj(item) and non_empty(item.get('id')):
            if item['id'] in ids:
                errors.append('Two entries share the id "' + item['id'] + '".')
            ids.add(item['id'])
    if not item_errors:
        n = len(obj['items'])
        checks.append(str(n) + ' ' + (t['noun'] if n == 1 else t['nouns']) + ', all with the required fields')
    if not obj['items']:
        warnings.append('The file has no ' + t['nouns'] + '. Publishing it will empty the ' + t['label'] + ' tab.')
    return errors, warnings, checks


# ---------------------------------------------------------------- diffs (same wording as the hub's preview)
def changed_fields(a, b):
    keys = set((a or {}).keys()) | set((b or {}).keys())
    return [k for k in keys if json.dumps((a or {}).get(k), sort_keys=False) != json.dumps((b or {}).get(k), sort_keys=False)]


def diff_items(target, old, new):
    old = old if isinstance(old, list) else []
    new = new if isinstance(new, list) else []
    by_old = {i['id']: i for i in old if is_obj(i) and i.get('id')}
    by_new = {i['id']: i for i in new if is_obj(i) and i.get('id')}
    added, removed, changed, unchanged = [], [], [], 0
    for it in new:
        if not is_obj(it) or not it.get('id'):
            continue
        prev = by_old.get(it['id'])
        if prev is None:
            added.append(item_label(target, it))
        else:
            f = changed_fields(prev, it)
            if f:
                changed.append((item_label(target, it), f))
            else:
                unchanged += 1
    for it in old:
        if is_obj(it) and it.get('id') and it['id'] not in by_new:
            removed.append(item_label(target, it))
    kept_old = [i['id'] for i in old if is_obj(i) and i.get('id') in by_new]
    kept_new = [i['id'] for i in new if is_obj(i) and i.get('id') in by_old]
    return {'added': added, 'removed': removed, 'changed': changed, 'unchanged': unchanged, 'reordered': kept_old != kept_new}


def diff_config(old, new):
    old, new = old or {}, new or {}
    ot = {t['name']: t for t in old.get('tags', []) if is_obj(t) and 'name' in t}
    nt = {t['name']: t for t in new.get('tags', []) if is_obj(t) and 'name' in t}
    oc = {c['name']: c for c in old.get('amcCategories', []) if is_obj(c) and 'name' in c}
    nc = {c['name']: c for c in new.get('amcCategories', []) if is_obj(c) and 'name' in c}
    added = ['tag ' + n for n in nt if n not in ot] + ['category ' + n for n in nc if n not in oc]
    removed = ['tag ' + n for n in ot if n not in nt] + ['category ' + n for n in oc if n not in nc]
    changed = [('category ' + n, changed_fields(oc[n], nc[n])) for n in nc if n in oc and json.dumps(oc[n]) != json.dumps(nc[n])]
    fkeys = lambda o: [str(f.get('target')) + ':' + str(f.get('id')) for f in (o.get('featured') or []) if is_obj(f)]
    if sorted(fkeys(old)) != sorted(fkeys(new)):
        changed.append(('home page featured items', ['featured']))
    elif fkeys(old) != fkeys(new):
        changed.append(('home page featured order', ['featured']))
    names = lambda arr: [x.get('name') for x in (arr or []) if is_obj(x)]
    reordered = not added and not removed and (names(old.get('amcCategories')) != names(new.get('amcCategories')) or names(old.get('tags')) != names(new.get('tags')))
    return {'added': added, 'removed': removed, 'changed': changed, 'unchanged': 0, 'reordered': reordered}


def summarize(d):
    parts = []
    if d['added']: parts.append(str(len(d['added'])) + ' added')
    if d['changed']: parts.append(str(len(d['changed'])) + ' edited')
    if d['removed']: parts.append(str(len(d['removed'])) + ' removed')
    if d['reordered']: parts.append('order changed')
    return ', '.join(parts) if parts else 'no changes'


# ---------------------------------------------------------------- extra advice (needs the original or config)
def viz_references(viz):
    refs = []
    def add(v):
        if isinstance(v, str) and v: refs.append(v)
        elif isinstance(v, list):
            for x in v: add(x)
    for d in viz.get('derived', []) or []:
        if not is_obj(d): continue
        if 'ratio' in d: add(d['ratio'])
        if 'concat' in d: add(d['concat'])
        if is_obj(d.get('map')): add(d['map'].get('col'))
        if is_obj(d.get('path')): add(d['path'].get('col'))
    for k in viz.get('kpis', []) or []:
        if not is_obj(k): continue
        for key in ['sum', 'ratio', 'distinct', 'wavg', 'top']:
            if key in k and key != 'rows': add(k[key])
        if is_obj(k.get('where')): add(k['where'].get('col'))
    dflt = viz.get('defaults') or {}
    for key in ['group', 'measure', 'x']:
        add(dflt.get(key))
    for key in ['labels', 'formats', 'agg']:
        add(list((viz.get(key) or {}).keys()))
    add(viz.get('hide') or [])
    if is_obj(viz.get('groupOrder')): add(viz['groupOrder'].get('col'))
    add(viz.get('rankBy'))
    if is_obj(viz.get('filter')): add(viz['filter'].get('col'))
    return refs


def amc_advice(item, categories):
    warnings = []
    who = '"' + item_label('amc-queries', item) + '"'
    if non_empty(item.get('type')) and categories is not None and item['type'] not in categories:
        close = [c for c in categories if c.lower() == item['type'].lower()]
        warnings.append(who + ': category "' + item['type'] + '" is not in the categories list' +
                        (' (did you mean "' + close[0] + '"? Match it exactly)' if close else '; add it in config.json first, or use one of: ' + ', '.join(categories)) + '.')
    ex = item.get('example') if is_obj(item.get('example')) else None
    cols = ex.get('columns') if ex and is_str_list(ex.get('columns')) else None
    viz = item.get('viz') if is_obj(item.get('viz')) else None
    if viz is not None:
        dflt = viz.get('defaults') or {}
        if 'top' in dflt and not isinstance(dflt['top'], str):
            warnings.append(who + ': viz.defaults.top should be text, for example "15" or "all", not a number.')
        derived_names = [d.get('name') for d in viz.get('derived', []) or [] if is_obj(d)]
        if cols is not None:
            for dn in derived_names:
                if dn in cols:
                    warnings.append(who + ': derived column "' + dn + '" has the same name as an output column; rename it.')
            missing = sorted({r for r in viz_references(viz) if r not in cols and r not in derived_names})
            if missing:
                warnings.append(who + ': analyzer settings name columns that are not in the example output: ' + ', '.join(missing) +
                                '. Check the spelling against the SQL output; settings with missing columns are silently ignored.')
        elif viz:
            warnings.append(who + ': has analyzer settings but no example output, so the column names cannot be checked.')
    sqls = [item.get('sql') or ''] + [p.get('sql') or '' for p in item.get('sqlParts', []) or [] if is_obj(p)]
    if not any('<BRAND NAME>' in s for s in sqls):
        warnings.append(who + ': SQL has no header block with <BRAND NAME> and <AMC INSTANCE> placeholders (team convention).')
    if non_empty(item.get('sql')) and not re.search(r'\bselect\b', item['sql'], re.I):
        warnings.append(who + ': SQL has no SELECT. It may be incomplete.')
    text = ' '.join([str(item.get(k) or '') for k in ['title', 'summary', 'description']] + [str(x) for k in ['howTo', 'requirements', 'useCases'] for x in (item.get(k) or [])])
    if '\u2014' in text:
        warnings.append(who + ': uses em dashes; the team style avoids them.')
    return warnings


def compare_before(target, before, after):
    errors, warnings = [], []
    for key in ['file', 'schemaVersion']:
        if before.get(key) != after.get(key):
            errors.append('"' + key + '" changed from ' + json.dumps(before.get(key)) + ' to ' + json.dumps(after.get(key)) + '. Keep it as it was.')
    for key in ['log', 'updatedAt', 'updatedBy']:
        if json.dumps(before.get(key)) != json.dumps(after.get(key)):
            warnings.append('"' + key + '" was changed. Leave it as it was; the hub replaces it when publishing.')
    if TARGETS[target]['kind'] == 'data':
        old = {i['id']: i for i in before.get('items', []) if is_obj(i) and i.get('id')}
        new_ids = {i.get('id') for i in after.get('items', []) if is_obj(i)}
        removed = [i for k, i in old.items() if k not in new_ids]
        added = [i for i in after.get('items', []) if is_obj(i) and i.get('id') not in old]
        for r in removed:
            for a in added:
                if item_label(target, r) == item_label(target, a):
                    errors.append('"' + item_label(target, r) + '" seems to have a new id ("' + str(r.get('id')) + '" became "' + str(a.get('id')) + '"). Keep the original id.')
        if before.get('items') and len(removed) >= max(3, len(before['items']) // 2):
            warnings.append(str(len(removed)) + ' of ' + str(len(before['items'])) + ' entries are missing. If you did not mean to remove them, the file was probably cut off.')
        if target == 'skills':
            for i in after.get('items', []):
                if is_obj(i) and i.get('id') in old and old[i['id']].get('skillData') != i.get('skillData') and old[i['id']].get('skillData'):
                    errors.append('"' + item_label(target, i) + '": the stored skill file (skillData) was changed. Copy it through exactly; replace skill files in Manage Page, Content.')
    return errors, warnings


# ---------------------------------------------------------------- site code
def check_site(path_name, text, before_text=None):
    errors, warnings, checks = [], [], []
    base = normalize_file_name(path_name)
    path = next((f for f in SITE_FILES if f.split('/')[-1] == base), None)
    if path is None:
        errors.append('"' + base + '" is not one of the site files (' + ', '.join(SITE_FILES) + ').')
        return errors, warnings, checks
    checks.append('Recognized as ' + path)
    if not text.strip():
        errors.append('The file is empty.')
        return errors, warnings, checks
    if path.endswith('.js'):
        node = shutil.which('node')
        if node:
            with tempfile.NamedTemporaryFile('w', suffix='.js', delete=False, encoding='utf-8') as f:
                f.write(text)
                tmp = f.name
            r = subprocess.run([node, '--check', tmp], capture_output=True, text=True)
            os.unlink(tmp)
            if r.returncode == 0:
                checks.append('JavaScript has no syntax errors (node --check)')
            else:
                errors.append('JavaScript syntax error: ' + (r.stderr.strip().splitlines() or ['unknown'])[-1])
        else:
            warnings.append('Could not check JavaScript syntax here (node is not installed). The hub checks it again on upload.')
        for fn in ['alert(', 'confirm(', 'prompt(']:
            if re.search(r'(?<![\w.])' + re.escape(fn), text) or re.search(r'window\.' + re.escape(fn), text):
                errors.append('Uses ' + fn + ') which is blocked inside other tools. Use inline messages and the two-click pattern.')
        warnings.append('Also upload index.html with HUB_BUILD and every ?v= raised, or browsers keep the old code.')
    else:
        if not re.search(r'<!doctype html>', text, re.I):
            errors.append('index.html must start with <!DOCTYPE html>.')
        missing = [f for f in REQUIRED_SCRIPTS if ('src="' + f) not in text]
        if missing:
            errors.append('index.html is missing script tags for: ' + ', '.join(missing) + '.')
        else:
            checks.append('Loads all site scripts')
        m = re.search(r'var GH_CONFIG = (\{.*?\});', text)
        if not m:
            errors.append('index.html is missing the GitHub connection (var GH_CONFIG). Publishing would stop working.')
        else:
            try:
                tok = json.loads(m.group(1)).get('token', '')
                if tok.startswith('ghp_') or tok.startswith('github_pat_'):
                    errors.append('The GitHub token is written in plain text. Use the split format from Settings, "Copy GH_CONFIG line".')
                elif tok and '.' not in tok:
                    warnings.append('The token is not in the split two-part format; GitHub may block the push.')
                else:
                    checks.append('GitHub connection present in the split format')
            except Exception:
                errors.append('The GH_CONFIG line is not valid JSON.')
        if 'id="app"' not in text:
            errors.append('index.html is missing the main page container (id="app").')
        build = re.search(r"var HUB_BUILD = '([^']+)'", text)
        versions = set(re.findall(r'\?v=([^"]+)"', text))
        if not build:
            errors.append('index.html is missing var HUB_BUILD.')
        elif versions != {build.group(1)}:
            errors.append('HUB_BUILD is ' + build.group(1) + ' but the script tags use ' + ', '.join(sorted(versions)) + '. Make them all the same.')
        else:
            checks.append('HUB_BUILD and all script versions match (' + build.group(1) + ')')
            if before_text:
                old = re.search(r"var HUB_BUILD = '([^']+)'", before_text)
                if old and old.group(1) == build.group(1):
                    warnings.append('HUB_BUILD was not raised. Raise it whenever code changes so open pages pick up the update.')
        if re.search(r'(?<![\w.])(alert|confirm|prompt)\(', re.sub(r'<style[\s\S]*?</style>', '', text)):
            warnings.append('index.html seems to call alert, confirm or prompt; these are blocked inside other tools.')
    return errors, warnings, checks


# ---------------------------------------------------------------- main
def parse_json(text):
    try:
        return json.loads(text), None
    except json.JSONDecodeError as e:
        tc = re.search(r',(\s*)([}\]])', text)
        if tc:
            line = text[:tc.start()].count('\n') + 1
            return None, 'Line ' + str(line) + ': extra comma before "' + tc.group(2) + '". Remove that comma.'
        return None, 'Line ' + str(e.lineno) + ', column ' + str(e.colno) + ': ' + e.msg


def main():
    ap = argparse.ArgumentParser(description='Check a Team Tools Hub file before uploading it.')
    ap.add_argument('file')
    ap.add_argument('--before', help='the original file as downloaded, to compare against')
    ap.add_argument('--config', help='config.json, to check tags and categories against the real lists')
    a = ap.parse_args()

    text = open(a.file, encoding='utf-8').read()
    name = normalize_file_name(a.file)
    errors, warnings, checks, summary = [], [], [], None

    if name.endswith('.html') or name.endswith('.js'):
        before_text = open(a.before, encoding='utf-8').read() if a.before else None
        errors, warnings, checks = check_site(name, text, before_text)
    else:
        target = next((k for k, t in TARGETS.items() if t['file'] == name), None)
        if target is None:
            errors.append('The file must be named one of: ' + ', '.join(t['file'] for t in TARGETS.values()) + ' (got "' + name + '").')
        else:
            checks.append('File name is ' + TARGETS[target]['file'])
            if len(text.encode('utf-8')) > SIZE_WARN:
                warnings.append('This file is ' + str(len(text.encode('utf-8')) // 1024) + ' KB. That works, but large files are slower to publish and load.')
            obj, err = parse_json(text)
            if err:
                errors.append('The file is not valid JSON. ' + err)
            else:
                checks.append('Valid JSON')
                tags, categories = None, None
                if a.config:
                    cfg = json.load(open(a.config, encoding='utf-8'))
                    tags = [t['name'] for t in cfg.get('tags', []) if is_obj(t) and 'name' in t]
                    categories = [c['name'] for c in cfg.get('amcCategories', []) if is_obj(c) and 'name' in c]
                elif target == 'config' and is_obj(obj):
                    categories = [c.get('name') for c in obj.get('amcCategories', []) if is_obj(c)]
                if target == 'amc-queries' and categories is None:
                    categories = DEFAULT_CATEGORIES
                e, w, c = validate_data(target, obj, tags)
                errors += e; warnings += w; checks += c
                if is_obj(obj) and target == 'amc-queries':
                    # With the original, advise only on queries that were added or edited, not untouched ones
                    untouched = set()
                    if a.before:
                        try:
                            orig = {i.get('id'): json.dumps(i, sort_keys=True) for i in json.load(open(a.before, encoding='utf-8')).get('items', []) if is_obj(i)}
                            untouched = {i.get('id') for i in obj.get('items', []) or [] if is_obj(i) and orig.get(i.get('id')) == json.dumps(i, sort_keys=True)}
                        except Exception:
                            untouched = set()
                    for it in obj.get('items', []) or []:
                        if is_obj(it) and it.get('id') not in untouched:
                            warnings += amc_advice(it, categories)
                if is_obj(obj) and target == 'config':
                    for cat in obj.get('amcCategories', []) or []:
                        if is_obj(cat) and cat.get('icon') not in ICON_IDS:
                            warnings.append('Category "' + str(cat.get('name')) + '": icon "' + str(cat.get('icon')) + '" is not one of the 18 icons; it will show the plain tag icon.')
                    # featured picks must point at entries that exist (checked when the data files sit next to config.json)
                    folder = os.path.dirname(os.path.abspath(a.file))
                    for f in obj.get('featured', []) or []:
                        if not is_obj(f) or f.get('target') not in DATA_TARGETS: continue
                        src = os.path.join(folder, f['target'] + '.json')
                        if os.path.exists(src):
                            try:
                                ids = {i.get('id') for i in json.load(open(src, encoding='utf-8')).get('items', []) if is_obj(i)}
                                if f.get('id') not in ids:
                                    warnings.append('Featured item ' + f['target'] + ' "' + str(f.get('id')) + '" does not exist in ' + f['target'] + '.json, so the home page will skip it.')
                            except Exception:
                                pass
                    cats = [c.get('name') for c in obj.get('amcCategories', []) or [] if is_obj(c)]
                    if 'Other' in cats and cats[-1] != 'Other':
                        warnings.append('"Other" is usually kept last in the categories list.')
                if a.before and is_obj(obj):
                    before, berr = parse_json(open(a.before, encoding='utf-8').read())
                    if berr:
                        warnings.append('Could not read the original file: ' + berr)
                    else:
                        e2, w2 = compare_before(target, before, obj)
                        errors += e2; warnings += w2
                        d = diff_config(before, obj) if target == 'config' else diff_items(target, before.get('items'), obj.get('items'))
                        summary = d

    print('CHECKS')
    for c in checks: print('  ok   ' + c)
    if errors:
        print('ERRORS (fix before uploading)')
        for e in errors: print('  x    ' + e)
    if warnings:
        print('WARNINGS')
        for w in warnings: print('  !    ' + w)
    if summary is not None:
        print('UPLOAD PREVIEW SHOULD SHOW: ' + summarize(summary))
        for n in summary['added']: print('  + added   ' + n)
        for n, f in summary['changed']:
            shown = sorted({FIELD_NAMES[x] for x in f if x in FIELD_NAMES})   # same field names the hub's preview shows
            print('  ~ edited  ' + n + ' (' + (', '.join(shown) or 'details') + ')')
        for n in summary['removed']: print('  - removed ' + n)
    print('RESULT: ' + ('NOT READY, fix the errors above' if errors else 'ready to upload' + (' (review the warnings)' if warnings else '')))
    sys.exit(1 if errors else 0)


if __name__ == '__main__':
    main()
