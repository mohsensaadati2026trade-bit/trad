دقیقاً این ساختار را پیاده می‌کنم. منطق را به دو بخش جدا می‌کنم: Context بازار از گذشته و Trigger ورود از C1 و C2. هیچ اندیکاتور یا اسیلاتوری وارد تصمیم نمی‌شود؛ فقط OHLC و ساختار قیمت.
معماری کلی
برای تایم انتخابی، مثلاً 2m:
HISTORY
   ↓
A) Major/Minor Trend
B) Support/Resistance
E) Strength toward Level
F) Movement Efficiency
   ↓
Market Context
══════════════════════════
C1 = آخرین کندل بسته‌شده
C2 = کندل در حال تشکیل
   ↓
C) Body / Shadow Psychology
D) H1/L1 vs H2/L2
+ C1 و C2 داخل E هم محاسبه می‌شوند
   ↓
BUY SCORE / SELL SCORE
   ↓
حداقل 70/100
   ↓
C3 = پیش‌بینی CALL یا PUT
A — روند ماژور و مینور
این قسمت از کندل‌های قبلی همان تایم‌فریم محاسبه می‌شود.
از روی Swing High و Swing Low:
HH = Higher High
HL = Higher Low
LH = Lower High
LL = Lower Low
اگر ساختار اصلی:
HH → HL → HH → HL
باشد:
Major = B
اگر:
LL → LH → LL → LH
باشد:
Major = S
برای Minor همین کار روی Swingهای نزدیک‌تر انجام می‌شود.
نتیجه می‌تواند مثلاً باشد:
Major = B
Minor = B       → B قوی

Major = B
Minor = S       → اصلاح نزولی داخل روند صعودی

Major = N
Minor = B       → ساختار کلی ساید، حرکت کوتاه‌مدت صعودی
برای این کار تاریخچه را هنگام Load از Quotex می‌گیریم؛ قرار نیست منتظر بمانیم 42 کندل جدید تشکیل شود.
________________________________________
B — حمایت و مقاومت
از گذشته Candidate Level می‌سازیم.
منابع:
عامل	کاربرد
Swing High/Low	نقاط چرخش
Reversal	برگشت واضح
Multiple Touch	چند واکنش در یک محدوده
Long Wick	رد شدید قیمت
Doji	توقف/تردید مهم
Round Number	سطح روانی
قیمت‌های خیلی نزدیک به هم یک Zone محسوب می‌شوند، نه پنج خط جدا.
مثلاً:
1.16518
1.16521
1.16524
ممکن است همگی تبدیل شوند به:
Resistance Zone ≈ 1.16521
نزدیک‌ترین حمایت‌ها و مقاومت‌های معتبر نگهداری می‌شوند.
بعد رفتار C2 نسبت به Level مهم می‌شود.
مثلاً در مقاومت:
Touch + Upper Wick + Close below level
→ S
اما:
Break resistance
+ strong body
+ price remains above level
→ B
بنابراین «مقاومت = SELL» نداریم.
________________________________________
C — روانشناسی C1 و C2
این یکی از مهم‌ترین Triggerهاست.
برای هر کندل:
Range = High - Low

Body = abs(Close - Open)

UpperWick =
High - max(Open, Close)

LowerWick =
min(Open, Close) - Low
و سپس:
BodyRatio = Body / Range
UpperRatio = UpperWick / Range
LowerRatio = LowerWick / Range
مثال قدرت خریدار
C2 Green
BodyRatio = 68%
UpperWick = 8%
LowerWick = 24%
Close نزدیک High
یعنی خریدار بیشتر کندل را کنترل کرده:
C = B
مثال ضعف خریدار
C2 Green
Body = 25%
UpperWick = 60%
Close از High شدیداً برگشته
با اینکه کندل سبز است:
C = S
چون خریداران قیمت را بالا برده‌اند ولی نتوانسته‌اند نگهش دارند.
رنگ کندل به‌تنهایی هیچ سیگنالی تولید نمی‌کند.
________________________________________
D — مقایسه High و Low دو کندل جدید
اینجا فقط:
C1 = کندل قبلی
C2 = کندل Live
استفاده می‌شوند.
حالت صعودی
H2 > H1
L2 > L1
یعنی:
Higher High + Higher Low
D = B
حالت نزولی
H2 < H1
L2 < L1
یعنی:
Lower High + Lower Low
D = S
Inside Candle
H2 < H1
L2 > L1
قیمت داخل محدوده C1 مانده.
خودش جهت ندارد:
D = N
اما Trend و شکل C2 برای تفسیر آن استفاده می‌شود.
Outside Candle
H2 > H1
L2 < L1
هر دو طرف C1 زده شده‌اند.
اینجا Close تعیین‌کننده است.
مثلاً:
Outside
Close near High
Bullish Body
→ B
یا:
Outside
Close near Low
Bearish Body
→ S
________________________________________
E — قدرت حرکت هنگام رسیدن به Level
اینجا همان نکته‌ای که الان روی آن توافق کردیم مهم است.
فرض کن موج از اینجا شروع شده:
Swing Low
   ↓
C-5
C-4
C-3
C-2
C1
C2
   ↓
Resistance
همه کندل‌های همین موج + C1 + C2 بررسی می‌شوند.
نه کل تاریخچه.
مثلاً Bodyها:
12
15
18
21
25
30
حرکت در حال قدرت گرفتن است:
Strength = EXPANDING
اگر حرکت صعودی به مقاومت باشد:
E = B
Break pressure ↑
اما:
32
28
23
17
12
7
یعنی هرچه به مقاومت نزدیک می‌شویم خریدار ضعیف‌تر می‌شود:
Strength = FADING
E = S
Rejection pressure ↑
حالت تقریباً ثابت:
21
22
20
23
22
حرکت سالم ولی بدون شتاب:
Strength = STABLE
حالت نامنظم:
30
8
27
11
31
9
قدرت جهت‌دار مشخصی ندارد:
E = N
فقط اندازه Body را هم نگاه نمی‌کنم. سایه مخالف جهت هم مهم است.
مثلاً هنگام صعود:
Bodyها کوچکتر
+
Upper Wickها بزرگتر
نشانه ضعف جدی‌تر خریدار است.
________________________________________
F — سرعت و کارایی حرکت
این همان چیزی است که در آموزش با تعداد کندل توضیح دادی.
فرض کنیم حرکت:
Support → Resistance
در 4 کندل انجام شده.
ولی برگشت قبلی:
Resistance → Support
10 کندل طول کشیده.
یعنی خریداران همان مسافت را خیلی سریع‌تر طی کرده‌اند.
به شکل ساده:
Movement Efficiency =
Price Distance / Number of Candles
اگر:
Bull Efficiency >> Bear Efficiency
داریم:
F = B
برعکس:
F = S
اگر اختلاف معنی‌دار نباشد:
F = N
C1 و C2 اگر جزو موج جاری باشند در این محاسبه هم وارد می‌شوند.
________________________________________
وزن نهایی
برای نسخه اول این وزن‌بندی را مناسب‌تر می‌دانم:
شرط	وزن
A — Major/Minor Trend	15
B — Level Interaction	15
C — Body/Shadow Psychology	25
D — H/L Relationship	20
E — Trend/Leg Strength	15
F — Movement Efficiency	10
مجموع	100
دلیل وزن بیشتر C و D این است که هدف ما پیش‌بینی C3 است؛ بنابراین اتفاقی که همین الآن در C1/C2 رخ می‌دهد باید از Context قدیمی مهم‌تر باشد.
مثلاً:
A Trend       B  +15
B Level       B  +15
C Psychology  B  +25
D H/L         B  +20
E Strength    S  +15
F Momentum    B  +10
نتیجه:
BUY  = 85
SELL = 15
پس:
C3 → CALL
ولی اگر:
BUY  = 65
SELL = 35
هیچ سیگنالی داده نمی‌شود.
نکته: 70/100 را 70٪ احتمال برد نمی‌نامیم. این فقط 70٪ توافق شروط سیستم است. درصد برد واقعی را بعداً از نتایج واقعی معاملات محاسبه می‌کنیم.
________________________________________
نحوه کار Live
مثلاً TF روی 2m است:
13:40–13:42 = C2
13:42–13:44 = C3
در تمام مدت C2:
Body
Wicks
H2
L2
Level interaction
E strength
مرتب Update می‌شوند.
در ثانیه‌های پایانی:
BUY 74 → WATCH CALL
BUY 81 → WATCH CALL
BUY 84 → CONFIRMED CALL
سپس برای C3:
13:42 → CALL 2m
اگر در ثانیه آخر وضعیت خراب شود:
BUY 68
سیگنال لغو می‌شود.
________________________________________
همه Pairهای باز
هر Pair بالای Quotex یک Engine مستقل خواهد داشت:
EUR/USD
GBP/USD
USD/JPY
AUD/CAD
EUR/JPY
...
برای هرکدام جداگانه:
History
Trend
S/R
Current Wave
C1
C2
Score
محاسبه می‌شود.
اگر مثلاً در حالی که روی EUR/USD هستی، AUD/CAD OTC به امتیاز 82 SELL برسد:
AUD/CAD OTC
PUT 82
آلارم PUT پخش می‌شود و Tab همان Pair قرمز می‌شود.
این معماری نسخه بعدی افزونه است: گذشته برای Context و قدرت موج؛ C1+C2 برای تصمیم نهایی درباره C3.

