package main

import (
	"encoding/json"
	"os"
	"strconv"
	"time"
)

type number = float64

func reducePairs(values []number) number {
	count := len(values)
	for count > 1 {
		for i := 0; i < count/2; i++ {
			values[i] = values[i*2] + values[i*2+1]
		}
		if count%2 != 0 {
			values[count/2] = values[count-1]
		}
		count = (count + 1) / 2
	}
	if len(values) == 0 {
		return 0
	}
	return values[0]
}

//go:noinline
func kernel(kind, n int, a, b []number) number {
	count := len(a)
	result := make([]number, count)
	if kind == 2 {
		products := make([]number, n)
		for row := 0; row < n; row++ {
			for col := 0; col < n; col++ {
				for k := 0; k < n; k++ {
					products[k] = a[row*n+k] * b[k*n+col]
				}
				result[row*n+col] = reducePairs(products)
			}
		}
	} else if kind == 1 {
		scaled := make([]number, count)
		for i := range scaled {
			scaled[i] = a[i] * 3
		}
		for i := range result {
			result[i] = scaled[i] + b[i]
		}
	} else {
		for i := range result {
			result[i] = a[i] * b[i]
		}
	}
	return reducePairs(result)
}

func main() {
	if len(os.Args) != 5 {
		panic("kind size iterations rounds required")
	}
	args := make([]int, 4)
	for i := range args {
		value, err := strconv.Atoi(os.Args[i+1])
		if err != nil {
			panic(err)
		}
		args[i] = value
	}
	kind, n, iterations, rounds := args[0], args[1], args[2], args[3]
	if kind < 0 || kind > 2 || n < 1 || iterations < 1 || rounds < 1 {
		panic("invalid arguments")
	}
	count := n
	if kind == 2 {
		count = n * n
	}
	a, b := make([]number, count), make([]number, count)
	for i := range a {
		a[i] = number(i%17-8) / 8
		b[i] = number(i%13-6) / 8
	}
	encoder := json.NewEncoder(os.Stdout)
	for round := -2; round < rounds; round++ {
		checksum := float64(0)
		start := time.Now()
		for i := 0; i < iterations; i++ {
			checksum += float64(kernel(kind, n, a, b))
		}
		elapsed := time.Since(start).Nanoseconds()
		if err := encoder.Encode(map[string]interface{}{"round": round, "ns": elapsed, "checksum": checksum}); err != nil {
			panic(err)
		}
	}
	for i := range a {
		if a[i] != number(i%17-8)/8 || b[i] != number(i%13-6)/8 {
			panic("input mutated")
		}
	}
}
