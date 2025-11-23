import google.generativeai as genai
import time
import datetime

genai.configure(api_key="AIzaSyCVhEzwncpZNRvXV7oIvuoHtfDMCboa-IM")

# 1. Upload the file to the File API (This is "Cold Storage" - Cheap/Free)
soc_file = genai.upload_file(path="Okta SOC1 Type II Report 2024.pdf")

# Wait for processing
while soc_file.state.name == "PROCESSING":
    time.sleep(2)
    soc_file = genai.get_file(soc_file.name)

# 2. Create the "Hot Cache" (This is the "Brain" - Costs per hour)
# We set a short TTL (Time To Live) because we will query it immediately.
# cache = genai.caching.CachedContent.create(
#     model="models/gemini-2.5-flash",
#     display_name="okta_soc_cache",
#     system_instruction="You are a SOC Audit extraction expert.",
#     contents=[soc_file],
#     ttl=datetime.timedelta(minutes=10) # Auto-delete after 10 mins
# )

# 3. Run your Queries against the CACHE (Not the file)
# model = genai.GenerativeModel.from_cached_content(cached_content=cache)

# ALTERNATIVE: Use the file directly (No explicit caching, but works for single session)
model = genai.GenerativeModel("models/gemini-2.5-flash", system_instruction="You are a SOC Audit extraction expert.")

# Query 1: Deviations
response_dev = model.generate_content(["Find all control deviations...", soc_file])
print(response_dev.text)
# Query 2: CUECs
response_cuec = model.generate_content(["List all CUECs...", soc_file])
print(response_cuec.text)

# 4. Done! 
# You don't need to manually delete; the TTL handles it. 
# You only paid for ~1 minute of cache storage.
