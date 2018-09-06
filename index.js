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

MongoClient.connect(url, function(err, client) {
	if(err) throw err;
	
	const dbName = "sensor";
	const collectionName = "rawdata";

	const db = client.db(dbName);

 	axios.get(remoteUrl + objectToParameters(requestParameters))
		.then(function(result){
			const matches = result.data.match(responseRe);
			if (matches && matches.length) {
				const response = JSON.parse(matches[1]);
				const resList = response.response_params;
				if (resList && resList.length){
					let dataSet = resList.filter(function(item){
						return ieeeList.indexOf(item.ieee) != -1;
					})
					.map(function(item){
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

						return insertData;
					});

					dataSet.forEach(function(data){
						db.collection(collectionName,function(err,collection){
							collection.insertOne(data);
						});
						console.log("Inserted: " + JSON.stringify(data) );
					})
				}
			}
			client.close();
		})
		.catch(function(err){
			console.error(err);
			client.close();
		});
});
