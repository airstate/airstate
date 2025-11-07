package main

import (
	"testing"
)

// BenchmarkRunAlgorithm benchmarks the runAlgorithm function
func BenchmarkRunAlgorithm(b *testing.B) {
	// Reset timer to exclude setup time
	b.ResetTimer()
	
	// Run the algorithm b.N times
	for i := 0; i < b.N; i++ {
		runAlgorithm()
	}
}

// BenchmarkRunAlgorithmParallel benchmarks runAlgorithm in parallel
func BenchmarkRunAlgorithmParallel(b *testing.B) {
	b.ResetTimer()
	b.RunParallel(func(pb *testing.PB) {
		for pb.Next() {
			runAlgorithm()
		}
	})
}

