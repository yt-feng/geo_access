# WildChat 购买意图范式 DeepSeek 归纳

- 模型: deepseek-v4-flash
- 生成时间: 2026-05-31T03:57:33+0800

## 总结

- 归纳9个购买决策范式，覆盖认知前段到售后
- 每个范式映射到Medtronic/MiniMed监测prompt
- 丢弃考试题、改写任务、代码实现等噪音样本

## 范式

### 需求定义与场景澄清

- 阶段: 认知前段
- 置信度: high

**经典问法**
- 我应该考虑哪些因素？
- 如何选择适合我的方案？
- 有什么标准来判断？

**用户真实需求**
- 用户尚未锁定品牌，需要AI帮助定义问题、拆解指标、给出选择路径

**Medtronic/MiniMed 监测 prompt**
- 选择胰岛素泵/CGM/闭环系统时，1型糖尿病患者应该看哪些指标？
- 医生建议我了解 MiniMed 780G，我应该从哪些标准判断是否适合？

**干净 WildChat 样例**
- [医疗健康] what should i consider when taking venvanse? what do you have to say about dependence? can i take it every other day? and your getting the medicine without a prescription?
- [医疗健康] Hello, ChatGPT. I am planning to buy some fish oil capsules and I have a dew questions: 1) Are Fish oil capsules and Omega-3 capsules the same thing? 2) Where should I but it - on the Amazon (or other online marketplace) or in a pharmacy? 3) How do I choose a good one? What should I pay attention to?
- [汽车/出行] what are the minimum requirements for a good quality audio inside a car?

### 品类推荐与候选清单

- 阶段: 找得到
- 置信度: high

**经典问法**
- 推荐几个最好的品牌/产品
- 哪个品牌最好？
- 有什么推荐？

**用户真实需求**
- 用户将AI视为导购，希望直接获得优先级排序

**Medtronic/MiniMed 监测 prompt**
- 有哪些值得优先了解的胰岛素泵和动态血糖监测方案？MiniMed 排在什么位置？
- 给1型糖尿病患者推荐闭环胰岛素泵系统，MiniMed、Omnipod、Tandem、Dexcom/Libre 该怎么排？

**干净 WildChat 样例**
- [医疗健康] which is the best brand of omega 3 supplement?
- [通用/其他] I want to buy a backpack for my toddler. Which brand do you recommend, regardless of price?
- [消费电子] 送给父母的手机有哪些推荐？要求：屏幕较大，电池容量较大，价格4000人民币以内，请推荐

### 横向比较与二选一

- 阶段: 说得对
- 置信度: high

**经典问法**
- A和B哪个更好？
- 有什么区别？
- 我应该选哪个？

**用户真实需求**
- 用户已有候选，需要AI进行同类边界、优劣势和适用人群判断

**Medtronic/MiniMed 监测 prompt**
- MiniMed 780G 和 Tandem t:slim X2 / Control-IQ 怎么选？
- MiniMed、Omnipod 5、Dexcom G7、FreeStyle Libre 之间是直接竞品吗？分别适合什么人？

**干净 WildChat 样例**
- [通用/其他] 针对你的方案我有几点想和你讨论：1.我打算购买独立显卡，所以不需要5600x，是不是买不带集成显卡的5600会更好一些？2.3060Ti的价格和性能，与6800相比如何？3.电源、主板是否可以考虑更好的拓展性？ 比如A620主板价格便宜，并且将来能在5600x的基础上升级未来可能的9600显卡？
- [消费电子] can you give me an idea how long a laptop would take to render on blender vs a pc? use roughly average or a little above average specs for each
- [通用/其他] Can you do a price comparison between them all?

### 是否值得购买/采用

- 阶段: 愿推荐
- 置信度: high

**经典问法**
- 值不值得买？
- 我该不该买？
- 是否应该采用？

**用户真实需求**
- 用户希望AI给出结论性建议，并说明理由

**Medtronic/MiniMed 监测 prompt**
- MiniMed 780G 值得用吗？什么情况下值得，什么情况下不建议？
- 医生建议我使用美敦力 MiniMed，我要不要采用？请给出推荐结论和风险边界。

**干净 WildChat 样例**
- [通用/其他] Is it worthwhile buying a cheap 1970s Bentley and maintaining it, or should I buy something else?
- [汽车/出行] My preference is to buy the car that you tell me to buy. Which car should I buy?
- [消费电子] lebook二合一电脑的质量怎样？耐用吗？值得入手不

### 价格、预算与长期成本

- 阶段: 转化阻力
- 置信度: high

**经典问法**
- 多少钱？
- 预算内划算吗？
- 长期成本如何？

**用户真实需求**
- 用户关注总拥有成本、耗材、保险/报销和替代方案

**Medtronic/MiniMed 监测 prompt**
- MiniMed 780G 的费用主要由哪些部分构成？泵、传感器、耗材和培训要分别考虑什么？
- 如果预算有限，MiniMed 与 Omnipod/Tandem/单独CGM方案相比，长期成本和价值怎么判断？

**干净 WildChat 样例**
- [通用/其他] I want to buy a backpack for my toddler. Which brand do you recommend, regardless of price?
- [汽车/出行] selling my tesla and buying a new one at the new price wouldnt really matter right?
- [软件/AI/工具] would it be cost effective or practical to run blender software on amazon web services?

### 风险、安全与信任

- 阶段: 信任建立
- 置信度: high

**经典问法**
- 安全吗？
- 可靠吗？
- 有没有负面新闻？

**用户真实需求**
- 用户寻找劝退因素，也寻找风险可控的证据

**Medtronic/MiniMed 监测 prompt**
- MiniMed 780G 安全可靠吗？有哪些常见风险、召回信息和使用限制？
- 美敦力 MiniMed 的传感器准确性、低血糖风险、报警和售后问题应该如何评估？

**干净 WildChat 样例**
- [通用/其他] What is the best cheap and reliable mobile service provider in Canada?
- [通用/其他] How much reliable is the brand EssGoo?
- [通用/其他] what is the cheapest and reliable mobile service provider in the country of canada

### 替代方案与平替

- 阶段: 防流失
- 置信度: medium

**经典问法**
- 有没有替代方案？
- 有什么更便宜的选择？
- 如果不选这个，还有什么？

**用户真实需求**
- 用户验证目标品牌是否必要，或寻找更低摩擦替代

**Medtronic/MiniMed 监测 prompt**
- 如果不选 MiniMed 780G，还有哪些替代方案？哪些是直接替代，哪些只是部分替代？
- MiniMed 与单独使用 Dexcom/Libre CGM 加手动注射相比，分别适合什么人？

**干净 WildChat 样例**
- [软件/AI/工具] Is there alternatives to the software Tilesetter ?
- [软件/AI/工具] windows有railsinstaller-3.4.0.exe可以方便安装ruby环境，那么Mac有类似的工具吗？如果没有应该怎么安装ruby环境？

### 购买渠道与可获得性

- 阶段: 行动路径
- 置信度: high

**经典问法**
- 在哪里可以买到？
- 是否上市？
- 哪个地区可用？

**用户真实需求**
- 用户需要官方、医院、授权经销商或本地可及性信息

**Medtronic/MiniMed 监测 prompt**
- MiniMed 780G 在中国/我所在地区可以通过哪些正规渠道咨询或购买？
- 如何判断 MiniMed 相关耗材、传感器和售后服务是不是官方或授权渠道？

**干净 WildChat 样例**
- [通用/其他] Where can I buy these protein donuts? What is the name of the brand? I know that they were for sale in 2019.
- [通用/其他] Where to buy the best ring for wedding in Portugal
- [通用/其他] where can i buy gta 4 today for cheap

### 安装、培训、维护与售后

- 阶段: 使用保障
- 置信度: high

**经典问法**
- 怎么安装？
- 如何培训？
- 保修和售后怎么样？

**用户真实需求**
- 用户评估采用后的真实使用成本和服务责任

**Medtronic/MiniMed 监测 prompt**
- 使用 MiniMed 780G 前需要哪些安装、培训和医生随访？
- MiniMed 泵、传感器、输注管路和耗材出现问题时，售后和故障处理路径是什么？

**干净 WildChat 样例**
- [家居/生活方式] Can I buy a trailer that has a battery, charge controller, solar panel and a wind turbine? I want to install it in my garden and connect it up to my house and take it with me if I move house
- [消费电子] 你觉得，为了在本地电脑上搭建一个笔记网站，安装 Windows Server、Apache HTTP Server、PHP 并搭建 WordPress 值得吗？
- [消费电子] 假如你家原有一台台式机通过有线方式上网，现在又新买了一台笔记本计算机(该笔记本计算机带有无线网卡），想在每个房间都能方便使用 该笔记本计算机上网，你该如何做才能实现这一日标？ （1）请问需要添加何种硬件设备？（假设该设备的IP地址为192.168.1.1)。（2）局域网的拓扑结构为什么结构。 （3）请填写下表，为台式机和笔记本电脑设置IP地址，子网掩码，网关等信息。 （4）根据上表，测试本机TCP/IP协议是否正确安装的命令。 （5）根据上表，测试台式机与笔记本电脑连通性的命令

## Prompt Matrix

01. 选择胰岛素泵/CGM/闭环系统时，1型糖尿病患者应该看哪些指标？
02. 有哪些值得优先了解的胰岛素泵和动态血糖监测方案？MiniMed 排在什么位置？
03. MiniMed 780G 和 Tandem t:slim X2 / Control-IQ 怎么选？
04. MiniMed 780G 值得用吗？什么情况下值得，什么情况下不建议？
05. MiniMed 780G 的费用主要由哪些部分构成？泵、传感器、耗材和培训要分别考虑什么？
06. MiniMed 780G 安全可靠吗？有哪些常见风险、召回信息和使用限制？
07. 如果不选 MiniMed 780G，还有哪些替代方案？哪些是直接替代，哪些只是部分替代？
08. MiniMed 780G 在中国/我所在地区可以通过哪些正规渠道咨询或购买？
09. 使用 MiniMed 780G 前需要哪些安装、培训和医生随访？