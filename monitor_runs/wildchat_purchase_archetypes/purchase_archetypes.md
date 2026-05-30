# WildChat 购买/选择意图经典范式

> 说明：这是用于 GEO prompt 设计的轻量范式挖掘，不是全量统计抽样。

- 扫描 conversations: 100001
- 扫描 user turns: 277976
- 命中 buyer turns: 833
- 输出样本数: 130

## 核心结论

- 购买意图不是一个问题，而是一条从需求定义、候选发现、比较、价格、风险、渠道到售后的决策链。
- AI 回答最容易影响品牌的时刻，是用户尚未点名品牌、只问品类推荐或选择标准的时候。
- 对医疗器械品牌，风险/安全问法既是劝退风险，也是建立信任的关键证据入口。
- GEO 监测不应只问品牌词，还要覆盖非品牌泛问、竞品对比、替代方案和行动路径。

## 需求定义与场景澄清

- 决策阶段：认知前段
- 经典问法：我有一个任务/疾病/预算/场景，应该看什么品类或方案？
- 真实需求：用户还没锁定品牌，先让 AI 帮他定义问题、拆指标、给选择路径。
- GEO 风险：如果 AI 的选型指标不包含品牌优势，品牌会在用户形成候选清单前被排除。
- 扫描命中数：9；入选样本数：9

### 对 Medtronic/MiniMed 的监测 prompt
- 选择胰岛素泵/CGM/闭环系统时，1型糖尿病患者应该看哪些指标？
- 医生建议我了解 MiniMed 780G，我应该从哪些标准判断是否适合？

### 四项指标映射
- 答案可见度：品类泛问下是否主动出现 MiniMed/美敦力。
- 认知准确度：是否把闭环泵、CGM、注射方案边界说清。
- 证据纳入度：是否引用指南、说明书、监管和临床证据。
- 推荐转化力：是否给出医生咨询、适用人群和下一步。

### WildChat 真实问法样例
- [医疗健康] what should i consider when taking venvanse? what do you have to say about dependence? can i take it every other day? and your getting the medicine without a prescription?
- [医疗健康] can you explain in what consist biossimilar medicines, compare them in terms of regulatory settings both in the EMA and the FDA settings, give examples of biossimilar medicine studies requirements in the last 5 years? please elaborate also on the concepts of switching and interchangeability.
- [医疗健康] Hello, ChatGPT. I am planning to buy some fish oil capsules and I have a dew questions: 1) Are Fish oil capsules and Omega-3 capsules the same thing? 2) Where should I but it - on the Amazon (or other online marketplace) or in a pharmacy? 3) How do I choose a good one? What should I pay attention to?
- [家居/生活方式] 如何选择跟家居有关的限量版和独特性的产品，给出10个英国受欢迎的网站
- [汽车/出行] what are the minimum requirements for a good quality audio inside a car?

## 品类推荐与候选清单

- 决策阶段：找得到
- 经典问法：请推荐几个最适合我的产品/品牌/服务。
- 真实需求：用户把 AI 当成导购和榜单入口，希望直接得到优先级。
- GEO 风险：品牌如果没有进入第一梯队，后续比较、价格和风险讨论都不会发生。
- 扫描命中数：134；入选样本数：18

### 对 Medtronic/MiniMed 的监测 prompt
- 有哪些值得优先了解的胰岛素泵和动态血糖监测方案？MiniMed 排在什么位置？
- 给1型糖尿病患者推荐闭环胰岛素泵系统，MiniMed、Omnipod、Tandem、Dexcom/Libre 该怎么排？

### 四项指标映射
- 答案可见度：推荐榜单中是否进入第一梯队。
- 认知准确度：推荐理由是否对应真实产品能力。
- 证据纳入度：是否有权威来源支撑推荐排序。
- 推荐转化力：是否愿意把 MiniMed 作为明确候选。

### WildChat 真实问法样例
- [医疗健康] which is the best brand of omega 3 supplement?
- [软件/AI/工具] what do you recommend books for software programming
- [通用/其他] I want to buy a backpack for my toddler. Which brand do you recommend, regardless of price?
- [通用/其他] how to improve the independent critical thinking capability? Please recommend a book as well.
- [软件/AI/工具] 需要做一个背景生成+选定商品贴图的自动化工具，有什么推荐的吗？

## 横向比较与二选一

- 决策阶段：说得对
- 经典问法：A 和 B 哪个更好？有什么区别？我应该选哪个？
- 真实需求：用户已经有候选，需要 AI 做同类边界、优劣势和适用人群判断。
- GEO 风险：AI 容易混淆代际、适应症、可用地区或把非同类产品当直接竞品。
- 扫描命中数：47；入选样本数：18

### 对 Medtronic/MiniMed 的监测 prompt
- MiniMed 780G 和 Tandem t:slim X2 / Control-IQ 怎么选？
- MiniMed、Omnipod 5、Dexcom G7、FreeStyle Libre 之间是直接竞品吗？分别适合什么人？

### 四项指标映射
- 答案可见度：竞品对比中品牌是否被完整提及。
- 认知准确度：是否混淆泵、CGM、算法、地区上市状态。
- 证据纳入度：是否给出官方/临床/监管证据。
- 推荐转化力：是否给出分人群选择结论。

### WildChat 真实问法样例
- [通用/其他] 针对你的方案我有几点想和你讨论：1.我打算购买独立显卡，所以不需要5600x，是不是买不带集成显卡的5600会更好一些？2.3060Ti的价格和性能，与6800相比如何？3.电源、主板是否可以考虑更好的拓展性？ 比如A620主板价格便宜，并且将来能在5600x的基础上升级未来可能的9600显卡？
- [消费电子] can you give me an idea how long a laptop would take to render on blender vs a pc? use roughly average or a little above average specs for each
- [软件/AI/工具] is there some kinda standard or method that people use to benchmark computers for blender rendering? any commonly used software or commonly rendered scenes that people generally use to compare computers?
- [医疗健康] can you explain in what consist biossimilar medicines, compare them in terms of regulatory settings both in the EMA and the FDA settings, give examples of biossimilar medicine studies requirements in the last 5 years? please elaborate also on the concepts of switching and interchangeability.
- [通用/其他] 1. Obtain the price of a European type put option with ?? = 0.1, ?? = 0.15, ?? = 0.4, ?? = 90, ?? = 100 and ?? = 2. b. Calculate the ‘exact’ value using the Black Scholes Formula. c. Make a table of error vs Number of Sample Paths in python. You may use the best technique to solve the problems most accurately. Make sure your answers are up to the mark for this quantitative finance question.

## 是否值得购买/采用

- 决策阶段：愿推荐
- 经典问法：我该不该买？值不值得？是否应该采用这个方案？
- 真实需求：用户希望 AI 给出结论性建议，并说明为什么现在买或不买。
- GEO 风险：回答如果只有风险提示、没有适合人群和下一步，会降低转化信心。
- 扫描命中数：10；入选样本数：10

### 对 Medtronic/MiniMed 的监测 prompt
- MiniMed 780G 值得用吗？什么情况下值得，什么情况下不建议？
- 医生建议我使用美敦力 MiniMed，我要不要采用？请给出推荐结论和风险边界。

### 四项指标映射
- 答案可见度：用户问要不要用时品牌露出是否靠前。
- 认知准确度：是否准确解释适合/不适合场景。
- 证据纳入度：是否用证据平衡价格、风险和疗效。
- 推荐转化力：是否形成明确、不过度的采用建议。

### WildChat 真实问法样例
- [通用/其他] What soft drink should I buy to focus more in class?
- [通用/其他] how many blank shirts, hoodies and hats should I buy of each size?
- [汽车/出行] My preference is to buy the car that you tell me to buy. Which car should I buy?
- [通用/其他] Is it worthwhile buying a cheap 1970s Bentley and maintaining it, or should I buy something else?
- [通用/其他] what si the general publics opinon on samsung nx1000 lenses. should i buy another lens and what are some really good cheap options atleast under 50

## 价格、预算与长期成本

- 决策阶段：转化阻力
- 经典问法：多少钱？贵不贵？预算内划算吗？长期成本如何？
- 真实需求：用户不是只问标价，还在问总拥有成本、耗材、保险/报销和替代方案。
- GEO 风险：AI 如果缺少成本构成或医保/保险边界，容易把用户导向低价替代。
- 扫描命中数：390；入选样本数：18

### 对 Medtronic/MiniMed 的监测 prompt
- MiniMed 780G 的费用主要由哪些部分构成？泵、传感器、耗材和培训要分别考虑什么？
- 如果预算有限，MiniMed 与 Omnipod/Tandem/单独CGM方案相比，长期成本和价值怎么判断？

### 四项指标映射
- 答案可见度：价格讨论中是否保留品牌价值点。
- 认知准确度：是否覆盖泵、传感器、耗材、培训和报销。
- 证据纳入度：是否标明价格来源和地区差异。
- 推荐转化力：是否避免只因高价导向竞品。

### WildChat 真实问法样例
- [金融/商业采购] how to price a new insurance risk and design insurance product when there is lack of data available?
- [旅行/本地服务] where in the UK has residential property with the greatest potential for price growth?
- [教育/职业] What is the price of the course by david sullivan "the go to physio" mentorship program?
- [通用/其他] I want to buy a backpack for my toddler. Which brand do you recommend, regardless of price?
- [金融/商业采购] What are the current market trends in Egypt's telecommunications? What are all the businesses in that kind of market/industry doing in terms of their 4PS (Product Price Place Promotion)? Are there new technologies that everyone is following/ are expected to follow in the following years?

## 风险、安全与信任

- 决策阶段：信任建立
- 经典问法：安全吗？可靠吗？有没有负面新闻、召回、副作用或隐私风险？
- 真实需求：用户在寻找劝退因素，也在寻找风险可控的证据。
- GEO 风险：风险表述失衡会直接劝退；证据不足会让品牌资产变成空泛口碑。
- 扫描命中数：41；入选样本数：18

### 对 Medtronic/MiniMed 的监测 prompt
- MiniMed 780G 安全可靠吗？有哪些常见风险、召回信息和使用限制？
- 美敦力 MiniMed 的传感器准确性、低血糖风险、报警和售后问题应该如何评估？

### 四项指标映射
- 答案可见度：风险问法中是否仍能呈现品牌资产。
- 认知准确度：召回、安全、准确性是否表述准确。
- 证据纳入度：是否纳入官方安全通告和监管资料。
- 推荐转化力：是否把风险和缓释方式一起讲清。

### WildChat 真实问法样例
- [通用/其他] What is the best cheap and reliable mobile service provider in Canada?
- [通用/其他] What is the most reliable, best gas mileage, suv that is available to purchase and where should it be purchased from
- [通用/其他] How much reliable is the brand EssGoo?
- [通用/其他] What is Windows Safe Mode used for? 1. For safe cleaning of hard disk contents 2 .To switch your computer to low power mode 3. To identify and fix a problem in Windows 4. To clear the device before transferring it to another user
- [家居/生活方式] 将下面的文字改的更加流畅、容易引起共情、充满温暖和希望的感觉：当发生灾难时，我们希望每一个人都得到救援。如果能够对受害者的统计数量有全面并精准的把握，会对有效的分派援助资源带来很大的帮助（尤其是在资源十分有限的情况下）。这些数字可能并不仅仅是官方渠道公布的那么简单，受伤、流离失所或受虐待的受害者的详细计数都需要被关注。 这篇文章将受害者提取看做问答任务，并分析了这种方法的可靠性。同时，也贴心的为大家提供了更多的建议：在什么情况下推荐使用哪个方法来提取数据会更高效。

## 替代方案与平替

- 决策阶段：防流失
- 经典问法：如果不选它，还有什么替代方案？有没有便宜/简单/更适合的选择？
- 真实需求：用户在验证目标品牌是否必要，或寻找更低摩擦替代。
- GEO 风险：AI 如果把替代方案讲得更完整，本品牌会丢失清晰的适用边界。
- 扫描命中数：3；入选样本数：3

### 对 Medtronic/MiniMed 的监测 prompt
- 如果不选 MiniMed 780G，还有哪些替代方案？哪些是直接替代，哪些只是部分替代？
- MiniMed 与单独使用 Dexcom/Libre CGM 加手动注射相比，分别适合什么人？

### 四项指标映射
- 答案可见度：替代方案中是否保留 MiniMed 适用边界。
- 认知准确度：是否区分直接替代和部分替代。
- 证据纳入度：替代品对比是否有同口径证据。
- 推荐转化力：是否说明何时仍应优先考虑 MiniMed。

### WildChat 真实问法样例
- [家居/生活方式] 了解国内天然气价格机制，包括用气成本，气源结构，政策改革历程 欧洲天然气消费和替代方案倾向 该找那一方面的专家了解这类问题
- [软件/AI/工具] Is there alternatives to the software Tilesetter ?
- [软件/AI/工具] windows有railsinstaller-3.4.0.exe可以方便安装ruby环境，那么Mac有类似的工具吗？如果没有应该怎么安装ruby环境？

## 购买渠道与可获得性

- 决策阶段：行动路径
- 经典问法：在哪里可以买到/咨询？是否上市？哪个地区可用？渠道是否正规？
- 真实需求：用户要把建议落地，需要官方、医院、授权经销商或本地可及性信息。
- GEO 风险：AI 给错渠道、灰色渠道或地区可用性，会造成转化流失和合规风险。
- 扫描命中数：33；入选样本数：18

### 对 Medtronic/MiniMed 的监测 prompt
- MiniMed 780G 在中国/我所在地区可以通过哪些正规渠道咨询或购买？
- 如何判断 MiniMed 相关耗材、传感器和售后服务是不是官方或授权渠道？

### 四项指标映射
- 答案可见度：行动路径中是否出现官方/授权渠道。
- 认知准确度：渠道、地区、上市状态是否准确。
- 证据纳入度：是否引用官方网站、医院或授权体系。
- 推荐转化力：是否给出安全可执行的咨询路径。

### WildChat 真实问法样例
- [通用/其他] Where can I buy these protein donuts? What is the name of the brand? I know that they were for sale in 2019.
- [旅行/本地服务] Where can i buy residential freehold property in the UK for under £30,000
- [通用/其他] Where to buy the best ring for wedding in Portugal
- [通用/其他] how about lenses, where can i buy them and how much do tehy usually cosst euros
- [通用/其他] 假设你是一个专业的产品经理，在做一个新产品的销售企划。该产品属于V1阶段，需要先在部分渠道进行试销后判断是否继续开发，为了让销售团队配合产品试销，制作一份说明资料需要包含哪些内容？

## 安装、培训、维护与售后

- 决策阶段：使用保障
- 经典问法：买后怎么安装、培训、保修、退换、维护和处理故障？
- 真实需求：用户在评估采用后的真实使用成本和服务责任。
- GEO 风险：AI 如果说不清医院、厂家、经销商的责任边界，会削弱医疗器械信任。
- 扫描命中数：75；入选样本数：18

### 对 Medtronic/MiniMed 的监测 prompt
- 使用 MiniMed 780G 前需要哪些安装、培训和医生随访？
- MiniMed 泵、传感器、输注管路和耗材出现问题时，售后和故障处理路径是什么？

### 四项指标映射
- 答案可见度：售后场景中是否关联官方服务能力。
- 认知准确度：培训、耗材、故障、责任边界是否准确。
- 证据纳入度：是否纳入说明书、售后政策、官方材料。
- 推荐转化力：是否降低采用后的不确定性。

### WildChat 真实问法样例
- [家居/生活方式] Can I buy a trailer that has a battery, charge controller, solar panel and a wind turbine? I want to install it in my garden and connect it up to my house and take it with me if I move house
- [消费电子] What is the camera setup of the Samsung Galaxy Note 20 Ultra?
- [软件/AI/工具] windows有railsinstaller-3.4.0.exe可以方便安装ruby环境，那么Mac有类似的工具吗？如果没有应该怎么安装ruby环境？
- [通用/其他] What is best setup for Agleron Algo BUY SELL RIBBON SEMAPHORE SR. BY Agleron
- [消费电子] 你觉得，为了在本地电脑上搭建一个笔记网站，安装 Windows Server、Apache HTTP Server、PHP 并搭建 WordPress 值得吗？
