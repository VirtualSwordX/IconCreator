const input = document.getElementById('pngFiles');

const inputPreviewDiv = document.getElementById('inputPreview');
const outputPreviewDiv = document.getElementById('outputPreview');

const uploadWarnings = document.getElementById('uploadWarnings');
const previewHeading = document.getElementById('previewHeading');

const warningsDiv = document.getElementById('warnings');

const icoChecklistDiv = document.getElementById('icoChecklist');
const icnsChecklistDiv = document.getElementById('icnsChecklist');
const sizeChecklistDiv = document.getElementById('sizeChecklist');

const outputDiv = document.getElementById('output');

// Clear everything mostly
document.getElementById('clearAll').addEventListener('click', () => {
    uploadedFiles = [];
    inputPreviewDiv.innerHTML = '';
    uploadWarnings.textContent = '';
    sizeChecklistDiv.innerHTML = '';
    outputDiv.innerHTML = '';
    outputPreviewDiv.innerHTML = '';
    warningsDiv.textContent = '';
    input.value = '';
    previewHeading.style.display = 'none';
    generateChecklist();
});

// Ico and ICNS Tab
document.querySelectorAll('.tabBtn').forEach(btn=>{
    btn.addEventListener('click', ()=>{
        document.querySelectorAll('.tabBtn').forEach(b=>b.classList.remove('active'));
        btn.classList.add('active');
        document.querySelectorAll('.tabContent').forEach(tc=>tc.classList.remove('active'));
        document.getElementById(btn.dataset.target).classList.add('active');
    });
});

window.addEventListener('DOMContentLoaded', () => {
    generateChecklist();
});

let uploadedFiles = [];

input.addEventListener('change', async () => {
    uploadWarnings.textContent = '';
    warningsDiv.textContent = '';
    previewHeading.style.display = 'none';

    // Keep existing uploadedFiles, only add new ones
    const newFiles = Array.from(input.files);
    for (let f of newFiles) {
        // Skip duplicate files (by name)
        if (uploadedFiles.find(u => u.file.name === f.name)) continue;

        const bitmap = await createImageBitmap(f);
        const valid = bitmap.width === bitmap.height && f.type === 'image/png';

        uploadedFiles.push({ file: f, width: bitmap.width, height: bitmap.height, valid });

        // Preview only the new file
        const container = document.createElement('div');
        const img = document.createElement('img');
        img.src = URL.createObjectURL(f);
        img.width = 64;
        img.height = 64;
        if (!valid) img.classList.add('invalid');

        const label = document.createElement('span');
        label.textContent = `${bitmap.width}x${bitmap.height}${valid ? '' : ' ✖'}`;

        container.appendChild(img);
        container.appendChild(label);
        inputPreviewDiv.appendChild(container);
    }

    generateChecklist(); 
});

// ------------------- Checklists -------------------
const validSizes = [16,24,32,48,64,128,256,512,1024]
const icoSizes = [16,24,32,48,64,128,256];
const icnsSizes = [
    { type:'icp4', size:16 },
    { type:'icp5', size:32 },
    { type:'icp6', size:64 },
    { type:'ic07', size:128 },
    { type:'ic08', size:256 },
    { type:'ic09', size:512 },
    { type:'ic10', size:1024 }
];

function generateChecklist() {
    sizeChecklistDiv.innerHTML = '';
    const checklistDiv = document.createElement('div');
    checklistDiv.classList.add('checklist');

    validSizes.forEach(size => {
        const div = document.createElement('div');
        const inputEl = document.createElement('input');
        inputEl.type = 'checkbox';
        const found = uploadedFiles.find(f=>f.width===size && f.valid);
        inputEl.checked = !!found;
        inputEl.disabled = !found;
        if(!found) div.classList.add('disabled');
        const label = document.createElement('label');
        label.textContent = `${size}x${size}`;
        div.appendChild(inputEl);
        div.appendChild(label);
        checklistDiv.appendChild(div);
    });

    sizeChecklistDiv.appendChild(checklistDiv);
}

// ------------------ Helpers -----------------------
async function resizeForTarget(file, targetSize) {
    const bitmap = await createImageBitmap(file);
    const canvas = new OffscreenCanvas(targetSize, targetSize);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(bitmap, 0, 0, targetSize, targetSize);
    const blob = await canvas.convertToBlob({ type: 'image/png' });
    return new Uint8Array(await blob.arrayBuffer());
}

function addPreview(blob, width, height, container) {
    previewHeading.style.display = 'block';
    const div = document.createElement('div');
    const img = document.createElement('img');
    
    img.src = URL.createObjectURL(blob);
    img.width = width;
    img.height = height;

    const info = document.createElement('span');
    info.textContent = `${width}x${height}`;
    
    div.appendChild(img);
    div.appendChild(info);
    container.appendChild(div);
}

// ------------------ ICO GENERATION ------------------
function writeLE(buffer, offset, value, bytes) {
    for (let i = 0; i < bytes; i++) {
        buffer[offset + i] = value & 0xff;
        value >>= 8;
    }
}

document.getElementById('createIco').addEventListener('click', async () => {
    const files = input.files;
    uploadWarnings.textContent = '';
    warningsDiv.textContent = '';
    previewHeading.style.display = 'none';
    outputPreviewDiv.innerHTML = '';
    outputDiv.innerHTML = '';

    if (!files.length) {
        uploadWarnings.textContent = 'No PNG files uploaded. Please add at least one PNG.';
        return;
    }

    try {
        const images = [];
        const resizeWarnings = [];

        // Prepare images and check for valid PNGs
        for (let f of files) {
            const bitmap = await createImageBitmap(f);
            // only PNG
            if (f.type !== 'image/png') continue;

            // Warn if not square
            if (bitmap.width !== bitmap.height) {
                resizeWarnings.push(
                    `Image ${f.name} is ${bitmap.width}x${bitmap.height}. It will be stretched/shrunk to square.`
                );
            }

            const ab = await f.arrayBuffer();
            images.push({ file: f, width: bitmap.width, height: bitmap.height, data: new Uint8Array(ab) });
        }

        if (!images.length) {
            uploadWarnings.textContent = 'No valid PNG. Please add at least one valid PNG';
            return; 
        }

        // Determine ICO sizes (16, 24, 32, 48, 64, 128, 256)
        const icoSizes = [16, 24, 32, 48, 64, 128, 256];
        const finalImages = [];

        for (let size of icoSizes) {
            // pick exact size first
            let exact = images.find(img => img.width === size);
            let best;

            if (exact) {
                best = exact;
            } else {
                // pick smallest bigger
                let bigger = images.filter(img => img.width > size).sort((a,b)=>a.width-b.width)[0];
                if (bigger) {
                best = bigger;
                    // Scaling down warning
                    resizeWarnings.push(`Size ${size} missing. Resizing larger image ${best.width}→${size}. Some detail may be lost.`);
                } else {
                // pick largest smaller
                    let smaller = [...images].sort((a,b)=>b.width - a.width)[0];
                    best = smaller;
                    // Scaling up warning
                    resizeWarnings.push(`Size ${size} missing. Resizing smaller image ${best.width}→${size}. Some quality may be lost.`);
                }
            }

            // resize if needed
            let data = (best.width !== size) ? await resizeForTarget(best.file, size) : best.data;

            finalImages.push({ width: size, height: size, data });
        }

        // Build ICO
        const numImages = finalImages.length;
        const header = new Uint8Array(6);
        writeLE(header, 2, 1, 2);
        writeLE(header, 4, numImages, 2);

        const dirEntries = new Uint8Array(16*numImages);
        let offset = 6 + 16*numImages;

        finalImages.forEach((img,i)=>{
            const entryOffset = i*16;
            dirEntries[entryOffset] = img.width===256?0:img.width;
            dirEntries[entryOffset+1] = img.height===256?0:img.height;
            dirEntries[entryOffset+2] = 0;
            dirEntries[entryOffset+3] = 0;
            writeLE(dirEntries, entryOffset+4, 1, 2);
            writeLE(dirEntries, entryOffset+6, 32, 2);
            writeLE(dirEntries, entryOffset+8, img.data.length, 4);
            writeLE(dirEntries, entryOffset+12, offset, 4);
            offset += img.data.length;
        });

        const totalSize = 6 + 16*numImages + finalImages.reduce((sum,img)=>sum+img.data.length,0);
        const icoBuffer = new Uint8Array(totalSize);
        icoBuffer.set(header,0);
        icoBuffer.set(dirEntries,6);
        let curr = 6 + 16*numImages;
        finalImages.forEach(img => { icoBuffer.set(img.data, curr); curr += img.data.length; });

        const blob = new Blob([icoBuffer], { type:'image/x-icon' });
        const url = URL.createObjectURL(blob);

        const link = document.createElement('a');
        link.href = url;
        link.download = 'icon.ico';
        link.textContent = `Download ICO (${(blob.size/1024).toFixed(1)} KB)`;

        // Preview each size
        outputPreviewDiv.innerHTML = '';
        finalImages.forEach(img => addPreview(new Blob([img.data], { type:'image/png' }), img.width, img.height, outputPreviewDiv));

        // Show warnings
        warningsDiv.textContent = resizeWarnings.join('\n');
        outputDiv.innerHTML = '';
        outputDiv.appendChild(link);

    } catch(err){
        console.error(err);
        alert('Error creating ICO: ' + err.message);
    }
});

// ------------------ ICNS GENERATION ------------------
function strToBytes(str) {
    const bytes = new Uint8Array(str.length);
    for (let i = 0; i < str.length; i++) bytes[i] = str.charCodeAt(i);
    return bytes;
}

function writeBE32(buffer, offset, value) {
    buffer[offset] = (value >> 24) & 0xff;
    buffer[offset + 1] = (value >> 16) & 0xff;
    buffer[offset + 2] = (value >> 8) & 0xff;
    buffer[offset + 3] = value & 0xff;
}

document.getElementById('createIcns').addEventListener('click', async () => {
    const files = input.files;
    uploadWarnings.textContent = '';
    warningsDiv.textContent = '';
    previewHeading.style.display = 'none';
    outputPreviewDiv.innerHTML = '';
    outputDiv.innerHTML = '';

    if (!files.length) {
        uploadWarnings.textContent = 'No PNG files uploaded. Please add at least one PNG.';
        return;
    }

    let filesWithSize = [];
    const resizeWarnings = [];

    for(let f of files){
        const bitmap = await createImageBitmap(f);
        if (f.type !== 'image/png') continue;
        
        // Warn if not square
        if (bitmap.width !== bitmap.height) {
            resizeWarnings.push(
                `Image ${f.name} is ${bitmap.width}x${bitmap.height}. It will be stretched/shrunk to square.`
            );
        }

        filesWithSize.push({ file: f, width: bitmap.width, height: bitmap.height });
    }
    if(!filesWithSize.length){
        uploadWarnings.textContent = 'No valid PNG. Please add at least one valid PNG.';
        return;
    }
    
    try {
        const blocks = [];

        for(let {type,size} of icnsSizes){
            // pick exact size first
            let exact = filesWithSize.find(f=>f.width===size);
            let best;
            if(exact) best = exact;
            else {
                // pick smallest bigger
                let bigger = filesWithSize.filter(f=>f.width>size).sort((a,b)=>a.width-b.width)[0];
                if(bigger){
                    best = bigger
                    resizeWarnings.push(`Size ${size} missing. Resizing larger image ${best.width}→${size}. Some detail may be lost.`);
                } else {
                    let smaller = [...filesWithSize].sort((a,b)=>b.width - a.width)[0];
                    best = smaller;
                    resizeWarnings.push(`Size ${size} missing. Resized smaller image ${best.width}→${size}. Some quality may be lost.`);
                }
            }

            const pngData = await resizeForTarget(best.file, size);
            const blockLen = 8+pngData.length;
            const block = new Uint8Array(blockLen);
            block.set(strToBytes(type),0);
            writeBE32(block,4,blockLen);
            block.set(pngData,8);
            blocks.push(block);
        }

        const totalLen = 8 + blocks.reduce((sum,b)=>sum+b.length,0);
        const icnsBuffer = new Uint8Array(totalLen);
        icnsBuffer.set(strToBytes('icns'),0);
        writeBE32(icnsBuffer,4,totalLen);

        let offset = 8;
        blocks.forEach(b=>{
            icnsBuffer.set(b,offset);
            offset+=b.length;
        });

        const blob = new Blob([icnsBuffer], { type:'application/octet-stream' });
        const url = URL.createObjectURL(blob);

        const link = document.createElement('a');
        link.href = url;
        link.download = 'icon.icns';
        link.textContent = `Download ICNS (${(blob.size/1024).toFixed(1)} KB)`;

        // Preview each size
        outputPreviewDiv.innerHTML = '';
        for (let { type, size } of icnsSizes) {
            const best = filesWithSize.find(f => f.width === size) ||
                        filesWithSize.filter(f => f.width > size).sort((a,b)=>a.width-b.width)[0] ||
                        filesWithSize.sort((a,b)=>b.width-a.width)[0];

            const resizedPNG = await resizeForTarget(best.file, size);
                addPreview(new Blob([resizedPNG], { type:'image/png' }), size, size, outputPreviewDiv);
        }

        warningsDiv.textContent = resizeWarnings.join('\n');
        outputDiv.innerHTML = '';
        outputDiv.appendChild(link);

    } catch(err){
        console.error(err);
        alert('Error creating ICNS: '+err.message);
    }
});

const modal = document.getElementById("tosModal");
const btn = document.getElementById("tosLink");
const span = document.querySelector(".close");

// Open modal
btn.onclick = function(e) {
    e.preventDefault();
    modal.style.display = "block";
}

// Close modal
span.onclick = function() {
    modal.style.display = "none";
}

// Close if click outside modal content
window.onclick = function(event) {
    if (event.target == modal) {
        modal.style.display = "none";
    }
}