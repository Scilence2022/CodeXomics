/**
 * Benchmark Statistics Engine - Advanced statistical analysis for LLM benchmark results
 */
class BenchmarkStatistics {
    constructor() {
        this.statisticalMethods = [
            'mean', 'median', 'mode', 'standardDeviation', 'variance',
            'percentiles', 'confidenceInterval', 'correlationAnalysis'
        ];
    }

    /**
     * Calculate overall statistics across all test suites
     */
    calculateOverallStatistics(testSuiteResults) {
        const allTestResults = [];
        const suiteStats = [];
        
        // Flatten all test results
        for (const suiteResult of testSuiteResults) {
            allTestResults.push(...suiteResult.testResults);
            suiteStats.push({
                suiteId: suiteResult.suiteId,
                suiteName: suiteResult.suiteName,
                stats: suiteResult.stats
            });
        }

        const overallStats = {
            totalTests: allTestResults.length,
            totalSuites: testSuiteResults.length,
            passedTests: allTestResults.filter(t => t.success).length,
            failedTests: allTestResults.filter(t => !t.success && t.status !== 'error').length,
            errorTests: allTestResults.filter(t => t.status === 'error').length,
            
            // Success rates
            overallSuccessRate: this.calculateSuccessRate(allTestResults),
            suiteSuccessRates: suiteStats.map(s => ({
                suiteId: s.suiteId,
                suiteName: s.suiteName,
                successRate: s.stats.successRate
            })),
            
            // Score statistics
            scoreStats: this.calculateScoreStatistics(allTestResults),
            
            // Performance statistics
            performanceStats: this.calculatePerformanceStatistics(allTestResults),
            
            // Error analysis
            errorAnalysis: this.analyzeErrors(allTestResults),
            
            // Complexity analysis
            complexityAnalysis: this.analyzeComplexity(allTestResults),
            
            // Correlation analysis
            correlationAnalysis: this.performCorrelationAnalysis(allTestResults),
            
            // Trend analysis
            trendAnalysis: this.analyzeTrends(allTestResults),
            
            // Quality metrics
            qualityMetrics: this.calculateQualityMetrics(allTestResults),
            
            // Reliability metrics
            reliabilityMetrics: this.calculateReliabilityMetrics(allTestResults)
        };

        return overallStats;
    }

    /**
     * Calculate statistics for a single test suite
     */
    calculateSuiteStatistics(testResults) {
        if (!testResults || testResults.length === 0) {
            return this.getEmptyStats();
        }

        const stats = {
            totalTests: testResults.length,
            passedTests: testResults.filter(t => t.success).length,
            failedTests: testResults.filter(t => !t.success && t.status !== 'error').length,
            errorTests: testResults.filter(t => t.status === 'error').length,
            
            successRate: this.calculateSuccessRate(testResults),
            scoreStats: this.calculateScoreStatistics(testResults),
            performanceStats: this.calculatePerformanceStatistics(testResults),
            errorAnalysis: this.analyzeErrors(testResults),
            
            // Test-specific metrics
            averageComplexity: this.calculateAverageComplexity(testResults),
            responseTimeDistribution: this.calculateResponseTimeDistribution(testResults),
            scoreDistribution: this.calculateScoreDistribution(testResults)
        };

        return stats;
    }

    /**
     * Calculate success rate
     */
    calculateSuccessRate(testResults) {
        if (testResults.length === 0) return 0;
        const successCount = testResults.filter(t => t.success).length;
        return (successCount / testResults.length) * 100;
    }

    /**
     * Calculate score statistics
     */
    calculateScoreStatistics(testResults) {
        const scores = testResults.map(t => t.score);
        const percentageScores = testResults.map(t => (t.score / t.maxScore) * 100);
        
        return {
            raw: {
                mean: this.mean(scores),
                median: this.median(scores),
                mode: this.mode(scores),
                standardDeviation: this.standardDeviation(scores),
                variance: this.variance(scores),
                min: Math.min(...scores),
                max: Math.max(...scores),
                range: Math.max(...scores) - Math.min(...scores)
            },
            percentage: {
                mean: this.mean(percentageScores),
                median: this.median(percentageScores),
                mode: this.mode(percentageScores),
                standardDeviation: this.standardDeviation(percentageScores),
                variance: this.variance(percentageScores),
                min: Math.min(...percentageScores),
                max: Math.max(...percentageScores),
                range: Math.max(...percentageScores) - Math.min(...percentageScores)
            },
            percentiles: {
                p25: this.percentile(percentageScores, 25),
                p50: this.percentile(percentageScores, 50),
                p75: this.percentile(percentageScores, 75),
                p90: this.percentile(percentageScores, 90),
                p95: this.percentile(percentageScores, 95),
                p99: this.percentile(percentageScores, 99)
            },
            confidenceInterval: this.confidenceInterval(percentageScores, 0.95)
        };
    }

    /**
     * Calculate performance statistics
     */
    calculatePerformanceStatistics(testResults) {
        const durations = testResults.map(t => t.duration);
        const responseTimes = testResults
            .map(t => t.metrics?.responseTime)
            .filter(rt => rt !== undefined);
        const tokenCounts = testResults
            .map(t => t.metrics?.tokenCount)
            .filter(tc => tc !== undefined);

        return {
            duration: {
                mean: this.mean(durations),
                median: this.median(durations),
                min: Math.min(...durations),
                max: Math.max(...durations),
                standardDeviation: this.standardDeviation(durations)
            },
            responseTime: responseTimes.length > 0 ? {
                mean: this.mean(responseTimes),
                median: this.median(responseTimes),
                min: Math.min(...responseTimes),
                max: Math.max(...responseTimes),
                standardDeviation: this.standardDeviation(responseTimes)
            } : null,
            tokenUsage: tokenCounts.length > 0 ? {
                mean: this.mean(tokenCounts),
                median: this.median(tokenCounts),
                total: tokenCounts.reduce((sum, count) => sum + count, 0),
                min: Math.min(...tokenCounts),
                max: Math.max(...tokenCounts)
            } : null,
            throughput: {
                testsPerSecond: testResults.length / (this.sum(durations) / 1000),
                averageTestDuration: this.mean(durations)
            }
        };
    }

    /**
     * Analyze errors
     */
    analyzeErrors(testResults) {
        const errorTests = testResults.filter(t => t.errors && t.errors.length > 0);
        const warningTests = testResults.filter(t => t.warnings && t.warnings.length > 0);
        
        const errorCategories = {};
        const errorPatterns = {};
        
        for (const test of errorTests) {
            for (const error of test.errors) {
                // Categorize errors
                const category = this.categorizeError(error);
                errorCategories[category] = (errorCategories[category] || 0) + 1;
                
                // Find patterns
                const pattern = this.extractErrorPattern(error);
                if (pattern) {
                    errorPatterns[pattern] = (errorPatterns[pattern] || 0) + 1;
                }
            }
        }

        return {
            totalErrors: errorTests.length,
            totalWarnings: warningTests.length,
            errorRate: (errorTests.length / testResults.length) * 100,
            warningRate: (warningTests.length / testResults.length) * 100,
            errorCategories: errorCategories,
            errorPatterns: errorPatterns,
            mostCommonError: this.getMostCommon(errorCategories),
            errorTrends: this.analyzeErrorTrends(testResults)
        };
    }

    /**
     * Analyze complexity vs performance
     */
    analyzeComplexity(testResults) {
        const complexityData = testResults
            .map(t => ({
                complexity: t.metrics?.instructionComplexity || 0,
                score: (t.score / t.maxScore) * 100,
                duration: t.duration,
                success: t.success
            }))
            .filter(d => d.complexity > 0);

        if (complexityData.length === 0) {
            return { available: false };
        }

        const complexityLevels = this.groupByComplexity(complexityData);
        
        return {
            available: true,
            complexityLevels: complexityLevels,
            correlations: {
                complexityVsScore: this.correlation(
                    complexityData.map(d => d.complexity),
                    complexityData.map(d => d.score)
                ),
                complexityVsDuration: this.correlation(
                    complexityData.map(d => d.complexity),
                    complexityData.map(d => d.duration)
                )
            },
            insights: this.generateComplexityInsights(complexityLevels)
        };
    }

    /**
     * Perform correlation analysis
     */
    performCorrelationAnalysis(testResults) {
        const metrics = testResults.map(t => ({
            score: (t.score / t.maxScore) * 100,
            duration: t.duration,
            responseTime: t.metrics?.responseTime || 0,
            tokenCount: t.metrics?.tokenCount || 0,
            complexity: t.metrics?.instructionComplexity || 0,
            functionCallsCount: t.metrics?.functionCallsCount || 0
        }));

        const correlations = {};
        const metricNames = ['score', 'duration', 'responseTime', 'tokenCount', 'complexity', 'functionCallsCount'];
        
        for (let i = 0; i < metricNames.length; i++) {
            for (let j = i + 1; j < metricNames.length; j++) {
                const metric1 = metricNames[i];
                const metric2 = metricNames[j];
                
                const values1 = metrics.map(m => m[metric1]).filter(v => v > 0);
                const values2 = metrics.map(m => m[metric2]).filter(v => v > 0);
                
                if (values1.length > 1 && values2.length > 1 && values1.length === values2.length) {
                    correlations[`${metric1}_vs_${metric2}`] = this.correlation(values1, values2);
                }
            }
        }

        return {
            correlations: correlations,
            strongCorrelations: this.findStrongCorrelations(correlations),
            insights: this.generateCorrelationInsights(correlations)
        };
    }

    /**
     * Analyze trends over time
     */
    analyzeTrends(testResults) {
        // Sort by start time
        const sortedResults = testResults.sort((a, b) => a.startTime - b.startTime);
        
        const windowSize = Math.max(5, Math.floor(sortedResults.length / 10));
        const trends = [];
        
        for (let i = 0; i <= sortedResults.length - windowSize; i += Math.floor(windowSize / 2)) {
            const window = sortedResults.slice(i, i + windowSize);
            const windowStats = {
                startIndex: i,
                endIndex: i + windowSize - 1,
                successRate: this.calculateSuccessRate(window),
                averageScore: this.mean(window.map(t => (t.score / t.maxScore) * 100)),
                averageDuration: this.mean(window.map(t => t.duration))
            };
            trends.push(windowStats);
        }

        return {
            trends: trends,
            overallTrend: this.calculateOverallTrend(trends),
            performance: this.analyzePerformanceTrend(trends),
            stability: this.analyzeStabilityTrend(trends)
        };
    }

    /**
     * Calculate quality metrics
     */
    calculateQualityMetrics(testResults) {
        const successfulTests = testResults.filter(t => t.success);
        const highScoreTests = testResults.filter(t => (t.score / t.maxScore) >= 0.8);
        const lowErrorTests = testResults.filter(t => t.errors.length === 0);
        
        return {
            excellence: (highScoreTests.length / testResults.length) * 100,
            reliability: (lowErrorTests.length / testResults.length) * 100,
            consistency: this.calculateConsistency(testResults),
            robustness: this.calculateRobustness(testResults),
            efficiency: this.calculateEfficiency(testResults)
        };
    }

    /**
     * Calculate reliability metrics
     */
    calculateReliabilityMetrics(testResults) {
        const scores = testResults.map(t => (t.score / t.maxScore) * 100);
        const durations = testResults.map(t => t.duration);
        
        return {
            scoreReliability: 100 - this.coefficientOfVariation(scores),
            performanceReliability: 100 - this.coefficientOfVariation(durations),
            errorFrequency: (testResults.filter(t => t.status === 'error').length / testResults.length) * 100,
            repeatability: this.calculateRepeatability(testResults),
            predictability: this.calculatePredictability(testResults)
        };
    }

    // Statistical calculation methods
    mean(values) {
        if (values.length === 0) return 0;
        return values.reduce((sum, val) => sum + val, 0) / values.length;
    }

    median(values) {
        if (values.length === 0) return 0;
        const sorted = [...values].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        return sorted.length % 2 === 0 
            ? (sorted[mid - 1] + sorted[mid]) / 2 
            : sorted[mid];
    }

    mode(values) {
        if (values.length === 0) return 0;
        const frequency = {};
        let maxFreq = 0;
        let mode = values[0];
        
        for (const value of values) {
            frequency[value] = (frequency[value] || 0) + 1;
            if (frequency[value] > maxFreq) {
                maxFreq = frequency[value];
                mode = value;
            }
        }
        
        return mode;
    }

    standardDeviation(values) {
        if (values.length === 0) return 0;
        const avg = this.mean(values);
        const squaredDiffs = values.map(val => Math.pow(val - avg, 2));
        return Math.sqrt(this.mean(squaredDiffs));
    }

    variance(values) {
        return Math.pow(this.standardDeviation(values), 2);
    }

    percentile(values, p) {
        if (values.length === 0) return 0;
        const sorted = [...values].sort((a, b) => a - b);
        const index = (p / 100) * (sorted.length - 1);
        
        if (Number.isInteger(index)) {
            return sorted[index];
        } else {
            const lower = Math.floor(index);
            const upper = Math.ceil(index);
            const weight = index - lower;
            return sorted[lower] * (1 - weight) + sorted[upper] * weight;
        }
    }

    confidenceInterval(values, confidence = 0.95) {
        if (values.length < 2) return { lower: 0, upper: 0 };
        
        const mean = this.mean(values);
        const std = this.standardDeviation(values);
        const n = values.length;
        
        // Using t-distribution for small samples
        const tValue = this.getTValue(confidence, n - 1);
        const margin = tValue * (std / Math.sqrt(n));
        
        return {
            lower: mean - margin,
            upper: mean + margin,
            margin: margin
        };
    }

    correlation(x, y) {
        if (x.length !== y.length || x.length < 2) return 0;
        
        const n = x.length;
        const sumX = this.sum(x);
        const sumY = this.sum(y);
        const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
        const sumXX = x.reduce((sum, xi) => sum + xi * xi, 0);
        const sumYY = y.reduce((sum, yi) => sum + yi * yi, 0);
        
        const numerator = n * sumXY - sumX * sumY;
        const denominator = Math.sqrt((n * sumXX - sumX * sumX) * (n * sumYY - sumY * sumY));
        
        return denominator === 0 ? 0 : numerator / denominator;
    }

    sum(values) {
        return values.reduce((sum, val) => sum + val, 0);
    }

    coefficientOfVariation(values) {
        const mean = this.mean(values);
        const std = this.standardDeviation(values);
        return mean === 0 ? 0 : (std / mean) * 100;
    }

    // Helper methods
    getTValue(confidence, degreesOfFreedom) {
        // Simplified t-table lookup for common confidence levels
        const tTable = {
            0.95: { 1: 12.706, 2: 4.303, 5: 2.571, 10: 2.228, 20: 2.086, 30: 2.042, 60: 2.000, 120: 1.980, Infinity: 1.960 },
            0.99: { 1: 63.657, 2: 9.925, 5: 4.032, 10: 3.169, 20: 2.845, 30: 2.750, 60: 2.660, 120: 2.617, Infinity: 2.576 }
        };
        
        const table = tTable[confidence] || tTable[0.95];
        
        for (const df of [1, 2, 5, 10, 20, 30, 60, 120]) {
            if (degreesOfFreedom <= df) {
                return table[df];
            }
        }
        
        return table[Infinity];
    }

    categorizeError(error) {
        const errorLower = error.toLowerCase();
        
        if (errorLower.includes('timeout')) return 'timeout';
        if (errorLower.includes('json') || errorLower.includes('parse')) return 'parsing';
        if (errorLower.includes('parameter') || errorLower.includes('argument')) return 'parameter';
        if (errorLower.includes('function') || errorLower.includes('tool')) return 'function_call';
        if (errorLower.includes('network') || errorLower.includes('connection')) return 'network';
        if (errorLower.includes('permission') || errorLower.includes('access')) return 'permission';
        
        return 'other';
    }

    extractErrorPattern(error) {
        // Extract common error patterns
        const patterns = [
            /(\w+) not found/i,
            /Invalid (\w+)/i,
            /Cannot (\w+)/i,
            /Failed to (\w+)/i,
            /(\w+) timeout/i
        ];
        
        for (const pattern of patterns) {
            const match = error.match(pattern);
            if (match) {
                return match[0];
            }
        }
        
        return null;
    }

    getMostCommon(frequency) {
        if (Object.keys(frequency).length === 0) return null;
        
        return Object.entries(frequency)
            .reduce((max, [key, value]) => value > max.value ? { key, value } : max, 
                    { key: null, value: 0 });
    }

    groupByComplexity(complexityData) {
        const groups = {
            low: complexityData.filter(d => d.complexity <= 3),
            medium: complexityData.filter(d => d.complexity > 3 && d.complexity <= 6),
            high: complexityData.filter(d => d.complexity > 6)
        };
        
        const result = {};
        for (const [level, data] of Object.entries(groups)) {
            if (data.length > 0) {
                result[level] = {
                    count: data.length,
                    averageScore: this.mean(data.map(d => d.score)),
                    averageDuration: this.mean(data.map(d => d.duration)),
                    successRate: (data.filter(d => d.success).length / data.length) * 100
                };
            }
        }
        
        return result;
    }

    generateComplexityInsights(complexityLevels) {
        const insights = [];
        
        const levels = Object.keys(complexityLevels);
        if (levels.length > 1) {
            const scores = levels.map(level => complexityLevels[level].averageScore);
            const durations = levels.map(level => complexityLevels[level].averageDuration);
            
            if (scores[scores.length - 1] < scores[0]) {
                insights.push('Performance decreases with instruction complexity');
            }
            
            if (durations[durations.length - 1] > durations[0] * 1.5) {
                insights.push('Response time significantly increases with complexity');
            }
        }
        
        return insights;
    }

    findStrongCorrelations(correlations) {
        const strong = {};
        
        for (const [pair, value] of Object.entries(correlations)) {
            if (Math.abs(value) >= 0.7) {
                strong[pair] = value;
            }
        }
        
        return strong;
    }

    generateCorrelationInsights(correlations) {
        const insights = [];
        
        if (correlations.score_vs_duration && correlations.score_vs_duration < -0.5) {
            insights.push('Higher scores tend to be achieved faster');
        }
        
        if (correlations.complexity_vs_score && correlations.complexity_vs_score < -0.5) {
            insights.push('More complex instructions lead to lower scores');
        }
        
        if (correlations.tokenCount_vs_score && correlations.tokenCount_vs_score > 0.5) {
            insights.push('Longer responses tend to have higher scores');
        }
        
        return insights;
    }

    calculateOverallTrend(trends) {
        if (trends.length < 2) return 'insufficient_data';
        
        const firstHalf = trends.slice(0, Math.floor(trends.length / 2));
        const secondHalf = trends.slice(Math.floor(trends.length / 2));
        
        const firstAvg = this.mean(firstHalf.map(t => t.successRate));
        const secondAvg = this.mean(secondHalf.map(t => t.successRate));
        
        const change = secondAvg - firstAvg;
        
        if (change > 5) return 'improving';
        if (change < -5) return 'declining';
        return 'stable';
    }

    analyzePerformanceTrend(trends) {
        if (trends.length < 2) return 'insufficient_data';
        
        const durations = trends.map(t => t.averageDuration);
        const scores = trends.map(t => t.averageScore);
        
        return {
            durationTrend: this.calculateTrendDirection(durations),
            scoreTrend: this.calculateTrendDirection(scores)
        };
    }

    analyzeStabilityTrend(trends) {
        if (trends.length < 3) return 'insufficient_data';
        
        const successRates = trends.map(t => t.successRate);
        const variance = this.variance(successRates);
        
        if (variance < 25) return 'stable';
        if (variance < 100) return 'moderate';
        return 'unstable';
    }

    calculateTrendDirection(values) {
        if (values.length < 2) return 'insufficient_data';
        
        const first = values[0];
        const last = values[values.length - 1];
        const change = ((last - first) / first) * 100;
        
        if (change > 10) return 'increasing';
        if (change < -10) return 'decreasing';
        return 'stable';
    }

    calculateConsistency(testResults) {
        const scores = testResults.map(t => (t.score / t.maxScore) * 100);
        return 100 - this.coefficientOfVariation(scores);
    }

    calculateRobustness(testResults) {
        const errorRate = (testResults.filter(t => t.status === 'error').length / testResults.length) * 100;
        return 100 - errorRate;
    }

    calculateEfficiency(testResults) {
        const durations = testResults.map(t => t.duration);
        const scores = testResults.map(t => (t.score / t.maxScore) * 100);
        
        // Efficiency = Average Score / Average Duration (normalized)
        const avgScore = this.mean(scores);
        const avgDuration = this.mean(durations);
        
        return (avgScore / (avgDuration / 1000)) * 10; // Scale for readability
    }

    calculateRepeatability(testResults) {
        // Measure how consistent results are for similar test types
        const testTypes = {};
        
        for (const test of testResults) {
            const type = test.testId.split('_')[0]; // Assume test IDs start with type
            if (!testTypes[type]) testTypes[type] = [];
            testTypes[type].push((test.score / test.maxScore) * 100);
        }
        
        let totalVariability = 0;
        let typeCount = 0;
        
        for (const scores of Object.values(testTypes)) {
            if (scores.length > 1) {
                totalVariability += this.coefficientOfVariation(scores);
                typeCount++;
            }
        }
        
        return typeCount > 0 ? 100 - (totalVariability / typeCount) : 100;
    }

    calculatePredictability(testResults) {
        // Measure how well we can predict test outcomes based on complexity
        const data = testResults
            .filter(t => t.metrics?.instructionComplexity)
            .map(t => ({
                complexity: t.metrics.instructionComplexity,
                success: t.success ? 1 : 0
            }));
        
        if (data.length < 5) return 50; // Default if insufficient data
        
        const complexities = data.map(d => d.complexity);
        const successes = data.map(d => d.success);
        
        const correlation = Math.abs(this.correlation(complexities, successes));
        return correlation * 100;
    }

    analyzeErrorTrends(testResults) {
        // Analyze if errors are becoming more or less frequent over time
        const windowSize = Math.max(3, Math.floor(testResults.length / 10));
        const errorRates = [];
        
        for (let i = 0; i <= testResults.length - windowSize; i += Math.floor(windowSize / 2)) {
            const window = testResults.slice(i, i + windowSize);
            const errorRate = (window.filter(t => t.status === 'error').length / window.length) * 100;
            errorRates.push(errorRate);
        }
        
        return this.calculateTrendDirection(errorRates);
    }

    calculateAverageComplexity(testResults) {
        const complexities = testResults
            .map(t => t.metrics?.instructionComplexity)
            .filter(c => c !== undefined);
        
        return complexities.length > 0 ? this.mean(complexities) : 0;
    }

    calculateResponseTimeDistribution(testResults) {
        const responseTimes = testResults
            .map(t => t.metrics?.responseTime)
            .filter(rt => rt !== undefined);
        
        if (responseTimes.length === 0) return null;
        
        return {
            fast: responseTimes.filter(rt => rt < 1000).length,
            medium: responseTimes.filter(rt => rt >= 1000 && rt < 5000).length,
            slow: responseTimes.filter(rt => rt >= 5000).length
        };
    }

    calculateScoreDistribution(testResults) {
        const percentageScores = testResults.map(t => (t.score / t.maxScore) * 100);
        
        return {
            excellent: percentageScores.filter(s => s >= 90).length,
            good: percentageScores.filter(s => s >= 70 && s < 90).length,
            fair: percentageScores.filter(s => s >= 50 && s < 70).length,
            poor: percentageScores.filter(s => s < 50).length
        };
    }

    getEmptyStats() {
        return {
            totalTests: 0,
            passedTests: 0,
            failedTests: 0,
            errorTests: 0,
            successRate: 0,
            scoreStats: { raw: {}, percentage: {}, percentiles: {} },
            performanceStats: { duration: {}, responseTime: null, tokenUsage: null },
            errorAnalysis: { totalErrors: 0, totalWarnings: 0, errorRate: 0 }
        };
    }
}

// Make available globally
window.BenchmarkStatistics = BenchmarkStatistics;
