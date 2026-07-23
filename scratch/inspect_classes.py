import sys
import re

def extract_strings(class_file_path):
    print(f"--- Strings in {class_file_path} ---")
    try:
        with open(class_file_path, "rb") as f:
            data = f.read()
    except Exception as e:
        print(f"Error reading file: {e}")
        return

    # A simple parser for Java class file constant pool UTF8 entries
    # Magic: 4 bytes (0xCAFEBABE)
    # Minor/Major: 4 bytes
    # Constant pool count: 2 bytes
    if len(data) < 10 or data[:4] != b'\xca\xfe\xba\xbe':
        print("Not a valid Java class file")
        return
    
    cp_count = int.from_bytes(data[8:10], byteorder='big')
    # Let's extract all sequences of printable ASCII chars longer than 2 characters
    # that look like method signatures, field names, or constructors.
    strings = []
    i = 10
    # A JVM bytecode constant pool parser is safer
    # Constant pool tags:
    # 1: Utf8, 3: Integer, 4: Float, 5: Long, 6: Double, 7: Class, 8: String, 9: Fieldref, 10: Methodref, 11: InterfaceMethodref, 12: NameAndType, 15: MethodHandle, 16: MethodType, 17: Dynamic, 18: InvokeDynamic, 19: Module, 20: Package
    tag_sizes = {
        3: 4, 4: 4, 5: 8, 6: 8, 7: 2, 8: 2, 9: 4, 10: 4, 11: 4, 12: 4,
        15: 3, 16: 2, 17: 4, 18: 4, 19: 2, 20: 2
    }
    
    idx = 1
    while idx < cp_count and i < len(data):
        tag = data[i]
        if tag == 1: # UTF-8
            length = int.from_bytes(data[i+1:i+3], byteorder='big')
            val = data[i+3:i+3+length].decode('utf-8', errors='ignore')
            strings.append(val)
            i += 3 + length
            idx += 1
        elif tag in tag_sizes:
            i += 1 + tag_sizes[tag]
            idx += 1
            if tag == 5 or tag == 6: # Long and Double occupy 2 entries
                idx += 1
        else:
            # Unknown tag, abort parser and use regex fallback
            break
            
    # Print interesting strings: constructors, methods, fields
    for s in strings:
        if s.startswith('<init>') or '(' in s or 'model' in s.lower() or 'voice' in s.lower() or 'token' in s.lower() or 'data' in s.lower() or 'lexicon' in s.lower():
            print(f"  {s}")

if __name__ == "__main__":
    base = "scratch/aar_extract/classes_extract/com/k2fsa/sherpa/onnx"
    extract_strings(f"{base}/OfflineTtsKokoroModelConfig.class")
    extract_strings(f"{base}/OfflineTtsModelConfig.class")
    extract_strings(f"{base}/OfflineTtsConfig.class")
    extract_strings(f"{base}/OfflineTts.class")
    extract_strings(f"{base}/GeneratedAudio.class")
