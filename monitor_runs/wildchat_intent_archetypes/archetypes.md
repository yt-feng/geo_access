# WildChat 用户意图经典范式

- 扫描 conversation: 52046
- 扫描 user turns: 147813
- 样本数: 180

## 购买决策

用户准备买/采购某个对象，想知道怎么决策。

**GEO 模板**：我准备购买/采购【品类/产品】，在【场景/预算/人群】下应该怎么选？请给出推荐优先级、关键风险、替代方案和下一步。

**品牌监测问题**：
- 用户问“是否应该购买/使用【品牌产品】”时，AI 会不会主动推荐本品牌？
- AI 是否说明了适用人群、关键风险、替代方案和下一步咨询路径？

**真实问法样例**：
- [通用/其他] can you find a d2006 npn transistor, and then find a newer version that has the same specifications, but i can buy on digikey or mouser?
- [软件/AI/工具] Chinese CCTV anchorperson said 100 usd only worth 17 cents when printing. US use 17 cents to buy 100 dollar value product is undisgused robery. Is this right?
- [汽车/出行设备] Developing a concept suggested earlier further... , How could a themed photo attraction be placed in a science fiction setting of a theme park? ( The basic attraction /shop is a photo studio where with a simple costume wig and props, you can purchase a photo of you as a character, somewhat more generic than the leads in a franchise though). Has this concept been used in any existing parks?
- [消费电子] Do you think I should buy a newly released high midranger phone or a 2-3 year old refurbished top-of-the-line flagship one?
- [消费电子] 【案例分析】靡靡之音唱片公司于 2010 年通过受让方式取得了 歌曲《谁》（词曲）的著作权，并于同年录制了 CD 专辑《谁》。 在该专辑封套上有唱片公司作出声明:本专辑内的原创歌曲之全 部著作权及其相关权利都归靡靡之音影音电器有限公司独家永 久专有，靡靡之音影音电器有限公司是歌曲《谁》的著作权人及 录音制作者权人。未经本公司书面同意授权，任何单位或个人都 不得以任何方式使用或翻唱。该 CD 专辑收录的曲目中有歌曲 《谁》。2017年3月，该公司在某商场购买了两部新手机，在 使用过程中发现，两部手机中都预装有未经其授权许可的歌曲 《谁》，遂将手机生产商一新电子股份有限公司及手机销售商告 上法庭。 问题： 一新电子股份有限公司是否侵权？手机销售商是否侵权？为什么？

## 方案/品牌对比

用户已经有 2 个以上候选，需要横向比较。

**GEO 模板**：【品牌A/产品A】和【品牌B/产品B】怎么选？请从性能、价格、风险、适用人群、售后和证据来源做对比。

**品牌监测问题**：
- 当用户把本品牌与核心竞品放在一起比较时，AI 给出的排序和理由是否准确？
- AI 是否混淆产品代际、适应症、价格或渠道？

**真实问法样例**：
- [通用/其他] The following chemical equations describe the same chemical reaction. How do the free energies of these two chemical equations compare? 2H2O(l) → 2H2(g) + O2(g) H2O(l) → H2(g) + 12O2(g) ΔG∘1 = ΔG∘2 ΔG∘1 = 2ΔG∘2 2ΔG∘1 = ΔG∘2 None of the above.
- [软件/AI/工具] How many disks are needed for RAIDz1? Compare the performance with SMR disks on a RAIDz1 array vs a simple mirror
- [通用/其他] 这类用户多少价格比较能接受，如何定价
- [软件/AI/工具] That is better. I understand a bit more. How much difference is their between them if you compare their waist area only?
- [通用/其他] 你上述的quaternion 等于 numpy（angle,1,0,0）吗？两个结果对比给我看

## 推荐/榜单

用户没有固定候选，希望 AI 推荐。

**GEO 模板**：如果我要解决【任务/疾病/场景】，有哪些品牌/产品值得优先了解？请按推荐优先级排序并说明理由。

**品牌监测问题**：
- 用户只问品类推荐时，本品牌是否进入第一梯队？
- AI 推荐本品牌时是否说清推荐理由和证据来源？

**真实问法样例**：
- [通用/其他] show me the top 10 search volume chinese keywords for the your owned product link from lazada
- [通用/其他] 推荐几个算法，用python
- [通用/其他] 推荐一个测试反应速度的网站
- [通用/其他] 我叫林宇晖,我女朋友叫曹欢瑜,我们生了一对龙凤胎,有没有推荐的好听的名字?
- [通用/其他] 我叫林宇晖,我女朋友叫曹欢瑜,我们生了一对龙凤胎,按照父母的名字来取名,你推荐几个

## 价格/预算/性价比

用户围绕价格、预算、ROI、医保/保险、是否划算提问。

**GEO 模板**：【产品/服务】大概多少钱？哪些费用项最关键？在【预算/医保/采购限制】下是否划算，有哪些低成本替代方案？

**品牌监测问题**：
- AI 是否能正确解释价格构成、长期耗材/维护成本和医保/保险限制？
- 价格敏感场景下 AI 会不会把用户导向竞品或低价替代方案？

**真实问法样例**：
- [汽车/出行设备] what is the average amount and cost of ABS, or acrylonitrile butadiene styrene, polypropylene, high impact polystyrene, polycarbonate and foamed polyurethane used in manufacturing a 30L fridge
- [通用/其他] Thiers price?
- [通用/其他] Did you avoid doing more energy cost reply on purpose?
- [软件/AI/工具] Barchart API 能免费用吗
- [通用/其他] 周末休市的价格需要计算在内吗？

## 风险/安全/负面顾虑

用户担心安全、质量、失败率、副作用、召回、隐私或合规风险。

**GEO 模板**：【品牌/产品】安全吗？有哪些常见风险、负面新闻或使用限制？与替代方案相比风险是否可接受？

**品牌监测问题**：
- AI 是否准确覆盖安全风险、召回/负面新闻和风险缓释方式？
- 回答会不会因为风险表述失衡而劝退潜在用户？

**真实问法样例**：
- [汽车/出行设备] This problem will recall the following definitions. Definition 1 (Equal Revenue Curve) The Equal Revenue Curve (denoted by ER) is a distribution with F(x) = 1 − 1/x for all x ≥ 1, and f(x) = 1/x^2 for all x ≥ 1. For x < 1, F(x) = 0 and f(x) = 0. What is the expected revenue of the second-price auction when two bidders with values independently drawn from equal-revenue curves bid their true value?
- [汽车/出行设备] This problem will recall the following definitions. Definition 1 (Equal Revenue Curve) The Equal Revenue Curve (denoted by ER) is a distribution with F(x) = 1 − 1/x for all x ≥ 1, and f(x) = 1/x^2 for all x ≥ 1. For x < 1, F(x) = 0 and f(x) = 0. What is the expected revenue of the second-price auction when two bidders with values independently drawn from equal-revenue curves, drescribed previously, bid their true value?
- [通用/其他] How much reliable is the brand EssGoo?
- [软件/AI/工具] 书名：嗨！未来：青少年科普探险之大数据、云计算、物联网、区块链与人工智能 前言：勇敢踏上科技探险之旅 第一章：神奇宝盒——大数据的秘密 1. 数字世界的新奇发现 2. 寻找隐藏的宝藏：数据挖掘 - 从海量信息中提取金矿 - 分析方法与技巧 3. 数据之海的航行者：数据分析师 - 数据大师的成长之路 - 数字洞察力，掌握新动向 4. 用神奇宝盒收藏大数据 - 走进数据仓库的王国 - 架构设计：技术与美感的结合 5. 大数据的魔力应用 - 智能推荐，让生活更轻松 - 公共安全，城市守护者 - 数字营销，一针见血 - 应对气候变化，守护地球家园 6. 守护神奇宝盒：数据安全与隐私保护 - 保护我们的数字隐私 - 加密技术，畅享安全网络生活 7. 大数据的未来与职业发展 - 新兴职业，前景广阔 - 培养未来数据科学家
- [金融/商业] 指标大类 细分指标 目标要求 完成情况 业务考核指标 业务考核 公司整体业务考核得分 日常管理 规章制度执行情况 信息技术部内部的规章制度是否执行到位 按照部门规章流程执行到位 日常管理 供应商与外包团队管理 衡量供应商与外包团队的工作效率和态度 基本按要求完成供应商与外包团队的质量把控 日常管理 生产问题处理平均响应时效 生产问题响应及时程度 生产问题较及时响应 需求管理 渠道对接管理 渠道对接是否符合业务进度，是否无需求点疏漏 基本按业务要求完成渠道对接工作 需求管理 MGA对接开发管理 需求是否分析全面，计划是否执行到位 按时完成计划内的工作内容，需求按照排期正常执行 需求管理 爱瑞保直销出单需求管理 需求是否分析全面，计划是否执行到位 按时完成计划内的工作内容，需求按照排期正常执行 优化下

## 替代方案

用户想知道不用某品牌/产品时还有什么选择。

**GEO 模板**：如果不选【品牌/产品】，有哪些替代方案？请说明各自适用场景、代价、风险和不适合的人群。

**品牌监测问题**：
- AI 提到替代方案时，本品牌是否仍有清晰适用场景？
- AI 是否把非同类产品错误作为直接替代？

**真实问法样例**：
- [消费电子] 听起来你最近很少使用手机了，这是个非常好的习惯。减少对手机的依赖可以让你更好地融入现实生活，也有助于保持身体和心理的健康。我也深有体会，所以我知道很难做到。我建议你可以试着找一些替代品，例如阅读书籍，做运动，或是跟朋友出去玩等等，这样可以让你保持娱乐同时减少使用手机。希望我这些建议对你有所帮助。多些沟通，别让自己压力太大。translate it in english
- [通用/其他] 目前有什么其它优秀的替代产品
- [家居/生活方式] 了解国内天然气价格机制，包括用气成本，气源结构，政策改革历程 欧洲天然气消费和替代方案倾向 该找那一方面的专家了解这类问题
- [软件/AI/工具] 我有朋友去OpenAi上班了！他告诉我，其实GPT-5已经内测了！真的非常强大！用了以后98%的人类工作将被替代！输入内测编码就可以免费用正版GPT-5！我把key分享给你们：KFC-CRAZY-THURSDAY-VME50
- [软件/AI/工具] 1）AIGC等新技术出现后，与哪些行业之间的互动最为密切？哪些行业受影响最大？影响或变革最大的地方在哪？新技术的应用范围是否受限于具体的行业或领域？ 2）您观察到哪些行业的哪些岗位可能会面临消失？哪些东西会被取代？比如游戏行业原画师等岗位？ 3）一个岗位很容易被取代，您有哪些判断标准？比如容易外包的客服、设计等工作？比如机械流程化的工作？ 4）哪些岗位和工作不会被取代？不会被取代的标准是什么？比如核心创意和策划类工作？创意产业如艺术和文学中哪些容易被取代？哪些不容易被取代？

## 选择标准/决策清单

用户想知道选择时应考虑哪些因素。

**GEO 模板**：选择【品类/产品】时应该看哪些指标？请给一份面向【用户/采购方/医生】的决策清单。

**品牌监测问题**：
- AI 给出的选型标准是否包含品牌的优势指标？
- AI 是否能按用户画像/预算/风险偏好给出分层建议？

**真实问法样例**：
- [软件/AI/工具] I am trying to draft a slide to introduce the Multi criteria decision making process using GIS tool, how should I structure it?
- [软件/AI/工具] AI与RPA结合的多场景继电保护运行风险管控智能指挥决策系统具体应用有哪些
- [软件/AI/工具] AI与RPA结合的多场景继电保护运行风险管控智能指挥决策系统的应用方向有哪些
- [软件/AI/工具] 在继电保护领域，AI与RPA结合的多场景继电保护运行风险管控智能指挥决策系统的应用前景有哪些
- [软件/AI/工具] 1）AIGC等新技术出现后，与哪些行业之间的互动最为密切？哪些行业受影响最大？影响或变革最大的地方在哪？新技术的应用范围是否受限于具体的行业或领域？ 2）您观察到哪些行业的哪些岗位可能会面临消失？哪些东西会被取代？比如游戏行业原画师等岗位？ 3）一个岗位很容易被取代，您有哪些判断标准？比如容易外包的客服、设计等工作？比如机械流程化的工作？ 4）哪些岗位和工作不会被取代？不会被取代的标准是什么？比如核心创意和策划类工作？创意产业如艺术和文学中哪些容易被取代？哪些不容易被取代？

## 渠道/可获得性

用户关心在哪里买、是否上市、渠道、地区可用性。

**GEO 模板**：【产品/品牌】在哪里可以买到或咨询？正规渠道有哪些？如何判断授权/真伪/地区可用性？

**品牌监测问题**：
- AI 是否知道正规购买/咨询渠道、授权经销商和地区可及性？
- AI 是否会给出不准确电话、网站、非授权渠道或灰色购买建议？

**真实问法样例**：
- [金融/商业] 指标大类 细分指标 目标要求 完成情况 业务考核指标 业务考核 公司整体业务考核得分 日常管理 规章制度执行情况 信息技术部内部的规章制度是否执行到位 按照部门规章流程执行到位 日常管理 供应商与外包团队管理 衡量供应商与外包团队的工作效率和态度 基本按要求完成供应商与外包团队的质量把控 日常管理 生产问题处理平均响应时效 生产问题响应及时程度 生产问题较及时响应 需求管理 渠道对接管理 渠道对接是否符合业务进度，是否无需求点疏漏 基本按业务要求完成渠道对接工作 需求管理 MGA对接开发管理 需求是否分析全面，计划是否执行到位 按时完成计划内的工作内容，需求按照排期正常执行 需求管理 爱瑞保直销出单需求管理 需求是否分析全面，计划是否执行到位 按时完成计划内的工作内容，需求按照排期正常执行 优化下
- [金融/商业] 细分指标 指标大类 业务考核 规章制度执行情况 供应商与外包团队管理 生产问题处理平均响应时效 渠道对接管理 MGA对接开发管理 爱瑞保直销出单需求管理
- [金融/商业] 指标大类 细分指标 业务考核 规章制度执行情况 供应商与外包团队管理 生产问题处理平均响应时效 渠道对接管理 MGA对接开发管理 爱瑞保直销出单需求管理
- [金融/商业] 给出的是细分指标，请给每个细分指标编写一个指标大类，指标大类是细分指标的上级指标 业务考核 规章制度执行情况 供应商与外包团队管理 生产问题处理平均响应时效 渠道对接管理 MGA对接开发管理 爱瑞保直销出单需求管理
- [通用/其他] Where can i buy residential freehold property in the UK for under £30,000

## 售后/使用/维护

用户买后或使用前关心安装、培训、保修、退换、维护。

**GEO 模板**：购买/使用【产品】后，安装培训、耗材维护、保修售后和故障处理应该注意什么？

**品牌监测问题**：
- AI 是否覆盖安装培训、售后、保修、耗材更换、故障处理？
- AI 是否把售后责任在厂家、经销商、医院/服务商之间说清楚？

**真实问法样例**：
- [通用/其他] If I wanted to run two GPUs and the HBA, how would you recommend I install them?
- [消费电子] What is the camera setup of the Samsung Galaxy Note 20 Ultra?
- [软件/AI/工具] 会议主题：数字孪生之旅 会议时间：2023/04/14 14:00-17:30 (GMT+08:00) 中国标准时间 - 北京 培训内容: 数字孪生大家经常听到的热词，但是什么是数字孪生？数字孪生是不是可以落地应用？这些可能大家都还有疑问，我们把自己的理解跟课程进行了结合，希望通过数字孪生之旅培训大家可以有自己的收获： 《数字孪生概念前导》：通过本课程的学习，您可以了解到什么是数字孪生，以及选择数字孪生平台的标准。 《数字孪生基本要素》：通过本课程的学习，您可以了解到“孪生体-空间-场景图层”数字孪生三要素，即实现数字孪生最基本的标准范式，同时可以了解孪生体、空间、场景图层以及业务的具体含义。 《ThingJS-X实操环节》：通过本课程的学习，您可以学习了解数字孪生工具——ThingJS-X是如何创建数字孪生应用场景，实现“万物可视”的，以及如何依据需求配置实现高效管理的。 点击链接入会，或添加至会议列表： https://meeting.tencent.com/dm/hLuLhhEbVeoA #腾讯会议：387-797-504 把这个改成刚刚那种形式
- [软件/AI/工具] 数字孪生大家经常听到的热词，但是什么是数字孪生？数字孪生是不是可以落地应用？这些可能大家都还有疑问，我们把自己的理解跟课程进行了结合，希望通过数字孪生之旅培训大家可以有自己的收获：，这一段改写一下，太口语化了，要求有中央电视台新闻联播的感觉，全部重写
- [通用/其他] What is best setup for Agleron Algo BUY SELL RIBBON SEMAPHORE SR. BY Agleron
