import os
import io
import base64
import torch
import numpy as np
from scipy.io import wavfile
from transformers import VitsModel, AutoTokenizer
from langchain_core.tools import tool

LANGUAGE_MODEL_MAP = {
    "en": "facebook/mms-tts-eng",
    "bn": "facebook/mms-tts-ben",
    "ar": "facebook/mms-tts-ara",
    "tr": "facebook/mms-tts-tur",
    "fa": "facebook/mms-tts-fas",                 # Persian / Farsi
    "ur": "facebook/mms-tts-urd-script_arabic",   # Urdu (Arabic Script variant)
}

class MultilingualStreamEngine:
    def __init__(self):
        self.device = "cuda" if torch.cuda.is_available() else "cpu"

    def generate_audio_base64(self, text: str, lang_code: str) -> str:
        """
        Synthesizes text to speech and returns the raw .wav audio data 
        encoded as an in-memory Base64 string.
        """
        model_id = LANGUAGE_MODEL_MAP.get(lang_code.lower())
        if not model_id:
            raise ValueError(f"Language code '{lang_code}' is not supported.")

        # 1. Load checkpoints from local cache
        tokenizer = AutoTokenizer.from_pretrained(model_id)
        model = VitsModel.from_pretrained(model_id).to(self.device)

        # 2. Tokenize inputs
        inputs = tokenizer(text, return_tensors="pt").to(self.device)

        # 3. Predict sound waveform structures
        with torch.no_grad():
            output = model(**inputs).waveform

        # Clean the array dimension bindings
        audio_data = output.cpu().numpy().squeeze()
        
        # 🌟 FIX 1: Hardlock sampling rate to 16000 Hz for Meta MMS models
        sampling_rate = 16000

        # 🌟 FIX 2: Normalize the raw Float32 data into a standard 16-bit signed Integer PCM format
        # This completely scales the volume and wipes away the robotic murmur/fuzz!
        audio_data = (audio_data * 32767).astype(np.int16)

        # 4. Write data to a virtual in-memory binary byte stream
        byte_io = io.BytesIO()
        wavfile.write(byte_io, rate=sampling_rate, data=audio_data)
        byte_io.seek(0)

        # 5. Convert binary content to string format
        base64_audio = base64.b64encode(byte_io.read()).decode('utf-8')
        return base64_audio

# Instantiate the streaming engine
stream_engine = MultilingualStreamEngine()

@tool
def text_to_speech_stream_tool(text: str, language: str) -> str:
    """
    Converts text strings into spoken audio data returned as a Base64 string.
    Inputs must be 'text' (the sentence) and 'language' (the 2-letter code like 'en', 'bn').
    """
    try:
        # Returns the raw alphanumeric string directly
        return stream_engine.generate_audio_base64(text, language)
    except Exception as e:
        return f"ERROR_FALLBACK: {str(e)}"