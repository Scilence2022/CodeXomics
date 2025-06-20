// 测试进化系统模块加载
console.log('🧪 Testing Evolution System Module Loading...');

// 检查关键模块是否存在
const modulesToCheck = [
    'ConversationAnalysisEngine',
    'AutoPluginGenerator', 
    'EvolutionPluginTestFramework',
    'ConversationEvolutionManager',
    'EvolutionInterfaceManager'
];

let loadedModules = 0;
let failedModules = [];

modulesToCheck.forEach(moduleName => {
    try {
        if (window[moduleName] && typeof window[moduleName] === 'function') {
            console.log(`✅ ${moduleName} - Loaded successfully`);
            loadedModules++;
        } else {
            console.log(`❌ ${moduleName} - Not found in window object`);
            failedModules.push(moduleName);
        }
    } catch (error) {
        console.log(`❌ ${moduleName} - Error: ${error.message}`);
        failedModules.push(moduleName);
    }
});

console.log(`\n📊 Summary:`);
console.log(`✅ Loaded: ${loadedModules}/${modulesToCheck.length}`);
console.log(`❌ Failed: ${failedModules.length}`);

if (failedModules.length > 0) {
    console.log(`❌ Failed modules: ${failedModules.join(', ')}`);
} else {
    console.log('🎉 All evolution system modules loaded successfully!');
}

// 测试基本实例化
if (window.ConversationEvolutionManager && window.EvolutionInterfaceManager) {
    try {
        console.log('\n🧪 Testing basic instantiation...');
        
        // 模拟依赖
        const mockChatManager = {
            addConversationUpdateListener: () => {},
            getConversationHistory: () => []
        };
        
        const mockPluginManager = {
            registerPlugin: () => {},
            getPlugins: () => []
        };
        
        const mockConfigManager = {
            get: () => null,
            set: () => {}
        };
        
        // 测试ConversationEvolutionManager
        const evolutionManager = new ConversationEvolutionManager(
            mockChatManager,
            mockPluginManager,
            mockConfigManager
        );
        console.log('✅ ConversationEvolutionManager instantiated successfully');
        
        // 测试EvolutionInterfaceManager  
        const interfaceManager = new EvolutionInterfaceManager(evolutionManager);
        console.log('✅ EvolutionInterfaceManager instantiated successfully');
        
        console.log('🎉 All basic tests passed!');
        
    } catch (error) {
        console.error('❌ Instantiation test failed:', error);
    }
} else {
    console.log('❌ Cannot test instantiation - required classes not available');
} 