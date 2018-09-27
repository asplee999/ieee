const MongoClient = require('mongodb').MongoClient;
const mysql = require('mysql');

const axios = require('axios');

const mongoUrl = "mongodb://localhost:27017";		
const mongodbName = "sensor";
const mongoCollectionName = "rawdata";

const mysqlConnection = mysql.createConnection({
	host     : 'localhost',
	user     : 'root',
	password : '9583ttld',
	database : 'soon8'
});
const mysqlTablename = "sensor_rawdata";

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

new Promise(function(resolve, reject){
	axios.get(remoteUrl + objectToParameters(requestParameters))
		.then(function(result){
			const matches = result.data.match(responseRe);
			let dataSet = [];
			if (matches && matches.length) {
				const response = JSON.parse(matches[1]);
				const resList = response.response_params;
				if (resList && resList.length){
					dataSet = resList.filter(function(item){
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
				}
			}
			resolve(dataSet);
		})
		.catch(function(err){ reject(err); });
})
.then(function(results){

	let sqlCommand = "";
	let sqlValues = results.map(function(item){
		return "(" + 
			[
				"'" + item._ieee + "'", 
				"'" + item._last_time + "'", 
				item.voltage, 
				item.temperature, 
				item.humidity
			].join(',')
		+ ")";
	});

	if ( sqlValues.length ) {
		sqlCommand = "INSERT INTO " + mysqlTablename + " (ieee, time, voltage, temperature, humidity) VALUES " + sqlValues.join(",");
	}

	MongoClient.connect(mongoUrl, function(err, client) {
		if(err) throw err;

		const db = client.db(mongodbName);

		results.forEach(function(data){
			db.collection(mongoCollectionName,function(err,collection){
				collection.insertOne(data);
			});
			console.log("Inserted: " + JSON.stringify(data) );
		})

		client.close();
	});

	if (sqlCommand) {
		mysqlConnection.connect();

		mysqlConnection.query(sqlCommand, function (error, results, fields) {
			if (error) throw error;
			
			console.log("Inserted: " + sqlValues.join(",") );
		});

		mysqlConnection.end();
	}
});

