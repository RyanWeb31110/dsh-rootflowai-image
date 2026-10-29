import { ImageError } from './errors.js';
const TYPES = new Set(['cover', 'inline', 'end']);
const STATUSES = new Set(['pending', 'ok', 'error', 'skipped', 'dry-run']);
function markerPattern() {
    return /<!--\s*ILLUST\b([\s\S]*?)-->/g;
}
export function defaultRatio(type) {
    if (type === 'cover')
        return '2.35:1';
    if (type === 'end')
        return '1:1';
    return '16:9';
}
export function parseRefList(ref) {
    if (!ref)
        return [];
    const seen = new Set();
    const out = [];
    for (const part of ref.split(/[,|]/)) {
        const key = part.trim();
        if (!key || seen.has(key))
            continue;
        seen.add(key);
        out.push(key);
    }
    return out;
}
function parseAttrs(source) {
    const out = {};
    const re = /([A-Za-z_][\w-]*)\s*=\s*(?:"((?:\\.|[^"\\])*)"|'((?:\\.|[^'\\])*)'|([^\s"']+))/g;
    for (const match of source.matchAll(re)) {
        const key = match[1];
        if (!key)
            continue;
        const raw = match[2] ?? match[3] ?? match[4] ?? '';
        out[key] = raw.replace(/\\(["'\\])/g, '$1');
    }
    return out;
}
function cleanCommentText(value) {
    return value.replace(/-->/g, '—>').replace(/\s+/g, ' ').trim();
}
function slotFromAttrs(attrs) {
    const id = attrs.id?.trim() ?? '';
    if (!id)
        throw new ImageError(400, 'invalid_slot', 'ILLUST marker requires id');
    if (!/^[A-Za-z0-9_-]+$/.test(id)) {
        throw new ImageError(400, 'invalid_slot', `ILLUST id ${id} must match [A-Za-z0-9_-]+`);
    }
    const typeRaw = attrs.type?.trim() || 'inline';
    if (!TYPES.has(typeRaw)) {
        throw new ImageError(400, 'invalid_slot', `ILLUST type ${typeRaw} must be cover, inline, or end`);
    }
    const type = typeRaw;
    const statusRaw = attrs.status?.trim() || 'pending';
    const status = STATUSES.has(statusRaw) ? statusRaw : 'pending';
    const prompt = attrs.prompt?.trim();
    const imageUrl = attrs.imageUrl?.trim();
    const localPath = attrs.localPath?.trim();
    return {
        id,
        type,
        ratio: attrs.ratio?.trim() || defaultRatio(type),
        ref: attrs.ref?.trim() ?? '',
        mood: attrs.mood?.trim() ?? '',
        note: attrs.note?.trim() ?? '',
        prompt: prompt || undefined,
        imageUrl: imageUrl || undefined,
        localPath: localPath || undefined,
        status,
    };
}
function stringField(value) {
    if (typeof value === 'string')
        return value;
    if (typeof value === 'number' && Number.isFinite(value))
        return String(value);
    return '';
}
/** Accept a JSON slot object from the HTTP API or the CLI. */
export function coerceSlot(input) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
        throw new ImageError(400, 'invalid_slot', 'slot must be an object');
    }
    const raw = input;
    const ref = Array.isArray(raw.ref)
        ? raw.ref.map((entry) => stringField(entry)).filter(Boolean).join(',')
        : stringField(raw.ref);
    return slotFromAttrs({
        id: stringField(raw.id),
        type: stringField(raw.type),
        ratio: stringField(raw.ratio),
        ref,
        mood: stringField(raw.mood),
        note: stringField(raw.note),
        prompt: stringField(raw.prompt),
        imageUrl: stringField(raw.imageUrl),
        localPath: stringField(raw.localPath),
        status: stringField(raw.status),
    });
}
/** Read every ILLUST marker, in document order. */
export function planSlots(markdown) {
    const slots = [];
    for (const match of markdown.matchAll(markerPattern())) {
        slots.push(slotFromAttrs(parseAttrs(match[1] ?? '')));
    }
    return slots;
}
/**
 * Remove ILLUST comments so a publish paste never contains them.
 * Other HTML comments are left alone. Blank runs collapse to one empty line.
 */
export function stripSlotsForPublish(markdown) {
    const stripped = markdown
        .replace(/^[ \t]*<!--\s*ILLUST\b[\s\S]*?-->[ \t]*$/gm, '')
        .replace(/<!--\s*ILLUST\b[\s\S]*?-->/g, '');
    return stripped.replace(/\n{3,}/g, '\n\n');
}
function quoteAttr(value) {
    const cleaned = cleanCommentText(value);
    if (/^[A-Za-z0-9_.:-]+$/.test(cleaned))
        return cleaned;
    return `"${cleaned.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}
/** Serialize one slot back into a single HTML comment. */
export function renderMarker(slot) {
    const parts = [
        `id=${quoteAttr(slot.id)}`,
        `type=${slot.type}`,
        `ratio=${quoteAttr(slot.ratio)}`,
    ];
    if (slot.ref)
        parts.push(`ref=${quoteAttr(slot.ref)}`);
    if (slot.mood)
        parts.push(`mood=${quoteAttr(slot.mood)}`);
    if (slot.note)
        parts.push(`note=${quoteAttr(slot.note)}`);
    if (slot.prompt)
        parts.push(`prompt=${quoteAttr(slot.prompt)}`);
    if (slot.imageUrl)
        parts.push(`imageUrl=${quoteAttr(slot.imageUrl)}`);
    if (slot.localPath)
        parts.push(`localPath=${quoteAttr(slot.localPath)}`);
    if (slot.status && slot.status !== 'pending')
        parts.push(`status=${slot.status}`);
    return `<!-- ILLUST ${parts.join(' ')} -->`;
}
/**
 * Rewrite markers whose id matches `slots`. Ids that are not in the draft
 * are appended at the end, which is how a new slot is injected.
 */
export function applySlotUpdates(markdown, slots) {
    const byId = new Map(slots.map((slot) => [slot.id, slot]));
    const present = new Set();
    const replaced = markdown.replace(markerPattern(), (full, inner) => {
        const attrs = parseAttrs(inner);
        const id = attrs.id?.trim();
        if (!id)
            return full;
        present.add(id);
        const slot = byId.get(id);
        return slot ? renderMarker(slot) : full;
    });
    const missing = slots.filter((slot) => !present.has(slot.id));
    if (missing.length === 0)
        return replaced;
    const suffix = missing.map((slot) => renderMarker(slot)).join('\n');
    if (replaced.length === 0)
        return `${suffix}\n`;
    return replaced.endsWith('\n') ? `${replaced}${suffix}\n` : `${replaced}\n\n${suffix}\n`;
}
//# sourceMappingURL=slots.js.map