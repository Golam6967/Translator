import sys
from tts_service import text_to_speech_stream_tool

def execute_translation_and_speech_flow():
    # If arguments are passed from your Express child_process exec command:
    if len(sys.argv) > 2:
        target_text = sys.argv[1]
        target_language = sys.argv[2]
    else:
        # Local testing default values
        target_text = "আমার অনুবাদ অ্যাপ্লিকেশনে আপনাকে স্বাগতম।"
        target_language = "bn"

    # Invoke the streaming tool inside the LangChain block
    base64_result = text_to_speech_stream_tool.invoke({
        "text": target_text, 
        "language": target_language
    })
    
    # Print ONLY the base64 string directly to sys.stdout
    # Node.js captures this exact stream buffer sequence
    sys.stdout.write(base64_result)
    sys.stdout.flush()

if __name__ == "__main__":
    execute_translation_and_speech_flow()