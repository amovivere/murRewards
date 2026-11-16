import pathlib
p = pathlib.Path(r'F:\WorkSpaces\Mur rewards\.design\rs-review\live\audit-hover.js')
s = p.read_text(encoding='utf-8')
old_filter = ".filter((el) => getComputedStyle(el).cursor === 'pointer');"
new_filter = """.filter((el) => {
            if (getComputedStyle(el).cursor !== 'pointer') return false;
            const parent = el.parentElement;
            if (parent && getComputedStyle(parent).cursor === 'pointer') return false;
            return true;
          });"""
assert old_filter in s
s = s.replace(old_filter, new_filter)
old_meta = "    const meta = await evalJs("
assert old_meta in s
s = s.replace(old_meta, "    const rootId = (await send('DOM.getDocument', { depth: 0 })).root.nodeId;\n    const meta = await evalJs(", 1)
old_node = "        nodeId: (await send('DOM.getDocument', { depth: 0 })).root.nodeId,"
assert old_node in s
s = s.replace(old_node, "        nodeId: rootId,")
p.write_text(s, encoding='utf-8')
print('patched')
