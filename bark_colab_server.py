"""
BARK AI TTS FLASK SERVER FOR GOOGLE COLAB (FAST EXECUTION EDITION)
------------------------------------------------------------------
Features:
- Fast pip install via wheel packages (suno-bark)
- Preloads lightweight fast Bark models (fine_use_small=True) to avoid 1.5GB downloads
- Automatic Cloudflare Tunnel integration (No auth token or registration needed!)
- Fallback to PyNgrok if needed
- VRAM Watchdog & CUDA cache flushing
"""

import io
import re
import gc
import time
import threading
import subprocess
import sys

print("Checking and installing dependencies...")
pkgs = ["suno-bark", "flask==3.0.3", "flask-cors==4.0.1", "scipy==1.13.1", "pyngrok==7.2.0"]
for pkg in pkgs:
    subprocess.run([sys.executable, "-m", "pip", "install", "-q", pkg], check=True)

import torch
import numpy as np
import scipy.io.wavfile as wav
from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
from bark import SAMPLE_RATE, generate_audio, preload_models

# Check GPU Availability
if not torch.cuda.is_available():
    print("WARNING: CUDA GPU not detected! Switch Runtime -> T4 GPU in Google Colab.")
else:
    print(f"GPU Active: {torch.cuda.get_device_name(0)}")

# Load Bark Fast Models
print("Preloading Bark lightweight models (~300MB weights)...")
preload_models(
    text_use_gpu=torch.cuda.is_available(),
    text_use_small=True,
    coarse_use_gpu=torch.cuda.is_available(),
    coarse_use_small=True,
    fine_use_gpu=torch.cuda.is_available(),
    fine_use_small=True,  # Lightweight model avoids multi-gigabyte downloads!
    codec_use_gpu=torch.cuda.is_available(),
    force_reload=False
)
gc.collect()
if torch.cuda.is_available():
    torch.cuda.empty_cache()

app = Flask(__name__)
CORS(app)

MAX_CHUNK = 170
GPU_LOCK = threading.Lock()

VOICES = {
    'narrator': 'v2/en_speaker_6',
    'professor': 'v2/en_speaker_3',
    'storyteller': 'v2/en_speaker_9',
    'energetic': 'v2/en_speaker_1',
    'female': 'v2/en_speaker_0',
    'deep': 'v2/en_speaker_8',
    'young': 'v2/en_speaker_2',
    'british': 'v2/en_speaker_7'
}

def vram_watchdog():
    if torch.cuda.is_available():
        used = torch.cuda.memory_allocated(0)
        total = torch.cuda.get_device_properties(0).total_memory
        if used / total > 0.85:
            gc.collect()
            torch.cuda.empty_cache()
            time.sleep(0.3)

def detect_emotion(text: str) -> str:
    t = text.lower()
    if re.search(r"\b(amazing|incredible|excellent|exciting|fantastic)\b", t):
        return "excited"
    if re.search(r"\b(important|critical|must|essential|warning|key)\b", t):
        return "emphatic"
    if re.search(r"\b(however|but|although|despite|yet|nevertheless)\b", t):
        return "cautious"
    if t.strip().endswith("?"):
        return "questioning"
    return "neutral"

def apply_emotion(text: str, emotion: str) -> str:
    if emotion == "excited" and not text.endswith("!"):
        text = text.rstrip(".") + "!"
    elif emotion == "cautious":
        text = "... " + text
    elif emotion == "emphatic":
        skip = {"about", "which", "these", "those", "their", "there", "would", "could", "should"}
        ws = text.split()
        text = " ".join([
            w.upper() if len(w) > 5 and w.lower() not in skip and 0 < i < len(ws) - 1 and w.isalpha() else w
            for i, w in enumerate(ws)
        ])
    return text

def safe_chunks(text: str):
    sents = re.split(r"(?<=[.!?])\s+", text.strip())
    out, cur = [], ""
    for s in sents:
        s = s.strip()
        if not s:
            continue
        if len(s) > MAX_CHUNK:
            for p in re.split(r"(?<=[,;:])\s+", s):
                p = p.strip()
                if not p:
                    continue
                if len(cur) + len(p) + 1 < MAX_CHUNK:
                    cur += (" " if cur else "") + p
                else:
                    if cur:
                        out.append(cur)
                    cur = p[:MAX_CHUNK]
        else:
            if len(cur) + len(s) + 1 < MAX_CHUNK:
                cur += (" " if cur else "") + s
            else:
                if cur:
                    out.append(cur)
                cur = s
    if cur:
        out.append(cur)
    return [c for c in out if c.strip()] or [text[:MAX_CHUNK]]

def safe_gen(text: str, preset: str):
    vram_watchdog()
    backoff = [1, 2, 4]
    for attempt in range(3):
        try:
            audio = generate_audio(text, history_prompt=preset)
            if audio is None or len(audio) == 0:
                raise ValueError("Generated empty audio array")
            return audio
        except Exception as e:
            print(f"  Attempt {attempt + 1}/3 failed: {e}")
            gc.collect()
            if torch.cuda.is_available():
                torch.cuda.empty_cache()
            time.sleep(backoff[attempt])
    raise RuntimeError("Synthesis failed after 3 retries")

@app.route("/tts", methods=["POST"])
def tts():
    t0 = time.time()
    try:
        data = request.json or {}
        text = data.get("text", "").strip()
        voice = data.get("voice", "narrator")
        emotion = data.get("emotion") or detect_emotion(text)
        if not text:
            return jsonify({"error": "No text provided"}), 400
        
        text = re.sub(r"[^\x00-\x7F]", " ", text)
        text = re.sub(r"\s+", " ", text).strip()[:900]
        preset = VOICES.get(voice, VOICES["narrator"])
        chunks = safe_chunks(apply_emotion(text, emotion))
        
        print(f"Processing TTS [{voice} | {emotion}] ({len(chunks)} chunks): {text[:60]}...")
        with GPU_LOCK:
            silence = np.zeros(int(SAMPLE_RATE * 0.12), dtype=np.float32)
            arrays = [safe_gen(c, preset) for c in chunks]
        
        final = arrays[0]
        for a in arrays[1:]:
            final = np.concatenate([final, silence, a])
            
        buf = io.BytesIO()
        wav.write(buf, SAMPLE_RATE, (final * 32767).astype(np.int16))
        buf.seek(0)
        
        app.req_count = getattr(app, "req_count", 0) + 1
        if app.req_count % 8 == 0 and torch.cuda.is_available():
            gc.collect()
            torch.cuda.empty_cache()
            
        print(f"  Done! Audio duration: {len(final)/SAMPLE_RATE:.1f}s | Elapsed: {time.time()-t0:.1f}s")
        return send_file(buf, mimetype="audio/wav")
    except Exception as e:
        print(f"ERROR in /tts: {e}")
        gc.collect()
        if torch.cuda.is_available():
            torch.cuda.empty_cache()
        return jsonify({"error": str(e)}), 500

@app.route("/ping")
def ping():
    res = {"status": "ok", "model": "bark-small", "voices": list(VOICES.keys())}
    if torch.cuda.is_available():
        res["vram_used_gb"] = round(torch.cuda.memory_allocated(0) / 1e9, 2)
        res["vram_total_gb"] = round(torch.cuda.get_device_properties(0).total_memory / 1e9, 2)
    return jsonify(res)

if __name__ == "__main__":
    threading.Thread(target=lambda: app.run(host="0.0.0.0", port=5000, threaded=True, use_reloader=False), daemon=True).start()
    time.sleep(1.5)

    print("Starting Cloudflare Tunnel (Zero token setup)...")
    try:
        subprocess.run(["wget", "-q", "-O", "cloudflared", "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64"], check=True)
        subprocess.run(["chmod", "+x", "cloudflared"], check=True)
        p = subprocess.Popen(["./cloudflared", "tunnel", "--url", "http://localhost:5000"], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        url = ""
        for _ in range(30):
            time.sleep(0.5)
            line = p.stderr.readline() if p.stderr else ""
            if "trycloudflare.com" in line:
                url = re.search(r"https://[a-zA-Z0-9-]+\.trycloudflare\.com", line).group(0)
                break
        if url:
            print("\n" + "=" * 60)
            print(" BARK TTS FLASK SERVER IS LIVE!")
            print(f" Public URL: {url}")
            print(" Paste this URL into your Smart PDF Reader Bark settings tab!")
            print("=" * 60 + "\n")
        else:
            raise RuntimeError("Cloudflare tunnel timeout")
    except Exception as e:
        print(f"Cloudflare tunnel notice ({e}), trying PyNgrok...")
        from pyngrok import ngrok
        ngrok.kill()
        tunnel = ngrok.connect(5000, bind_tls=True)
        print("\n" + "=" * 60)
        print(" BARK TTS FLASK SERVER IS LIVE!")
        print(f" Public URL: {tunnel.public_url}")
        print(" Paste this URL into your Smart PDF Reader Bark settings tab!")
        print("=" * 60 + "\n")
