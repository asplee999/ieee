const MongoClient = require('mongodb').MongoClient;
const axios = require('axios');
const url = "mongodb://localhost:27017";

function objectToParameters(obj){
	return Object.keys(obj).map(function(key){ return key + "=" + obj[key]; }).join('&');
}

const houseIeee = "00137A000003AC18";
const ieeeList = ["00137A0000047DC4","00137A0000047DE8"];
const dataKeys = ["voltage","temperature","humidity"];

const requestParameters = {
	json: JSON.stringify({houseIeee:houseIeee,orderBy:""}),
	"encodemet%20hod": "AES",
	houseIeeeSecret: houseIeee,
	sign: "AAA"
};

const remoteUrl = "http://210.61.40.166:8081/zigBeeDevice/deviceController/getfindlist.do?";

const responseRe = new RegExp("null\\((.*)\\)");

axios.get(remoteUrl + objectToParameters(requestParameters), {headers: {'Content-Type': 'application/json'} })
	.then(function(result){
		const matches = result.data.match(responseRe);
		if (matches && matches.length) {
			const response = JSON.parse(matches[1]);
			const resList = response.response_params;
			if (resList && resList.length){
				resList.filter(function(item){
					return ieeeList.indexOf(item.ieee) != -1;
				})
				.forEach(function(item){
					let insertData = {
						_last_time: item.lasttime,
						_name: item.deviceName,
						_houseieee: item.houseIeee,
						_ieee: item.ieee
					};
					let ids = item.clusterIds.split(',');
					let values = item.vals.split(',').map(function(val){return parseFloat(val).toFixed(2); });
					let valueMap = {};
					
					ids.forEach(function(id, idx){
            					valueMap[id] = values[idx];
            				});

					var sortedKeys = Object.keys(valueMap);

					sortedKeys.sort();

					sortedKeys.forEach(function(key, idx){
						insertData[ dataKeys[idx] ] = valueMap[key];
					});

					console.log(insertData);
				});
			}
		}
	})
	.catch(function(err){
		console.error(err);
	});

/*
MongoClient.connect(url, function(err, client) {
	if(err) throw err;
	//Write databse Insert/Update/Query code here..
	console.log('mongodb is running!');

	var db = client.db("TestDB");

	db.collection('TestPersons',function(err,collection){
		collection.insertOne({ id:1, firstName:'Steve', lastName:'Jobs' });
		collection.insertOne({ id:2, firstName:'Bill', lastName:'Gates' });
		collection.insertOne({ id:3, firstName:'James', lastName:'Bond' });
	});

  	client.close(); //關閉連線
});
*/
